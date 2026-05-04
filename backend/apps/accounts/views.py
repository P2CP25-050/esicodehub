from django.contrib.auth import authenticate
from django.conf import settings
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from apps.accounts.models import User, EmailVerification, Profile
from apps.accounts.serializers import (
    RegisterSerializer,
    VerifyEmailSerializer,
    ResendVerificationSerializer,
    LoginSerializer,
    ProfileUpdateSerializer,
    UserProfileSerializer,
    PublicProfileSerializer,
    ProfileSearchResultSerializer,
)
from apps.accounts.tasks import send_verification_email
from apps.forum.models import Answer, Question
from apps.esi_db.models import EsiStudent, EsiProfessor
from apps.personal_submissions.models import PersonalSubmission


def _set_refresh_cookie(response, refresh_token):
    """Store refresh token in a secure HttpOnly cookie."""
    response.set_cookie(
        key=settings.AUTH_REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response):
    """Remove refresh token cookie on logout or failed refresh."""
    response.delete_cookie(
        key=settings.AUTH_REFRESH_COOKIE_NAME,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


def _lookup_esi_person(email):
    """Look up email in EsiStudent first, then EsiProfessor.
    Returns (person_obj, role) or (None, None).
    """
    try:
        student = EsiStudent.objects.get(email=email)
        return student, User.Role.STUDENT
    except EsiStudent.DoesNotExist:
        pass
    try:
        professor = EsiProfessor.objects.get(email=email)
        return professor, User.Role.PROFESSOR
    except EsiProfessor.DoesNotExist:
        return None, None


def _create_and_send_verification(user):
    """Generate a 6-digit code, save EmailVerification, and send email."""
    code = EmailVerification.generate_code()
    EmailVerification.objects.create(user=user, code=code)
    send_verification_email.delay(user.email, code)


@api_view(['POST'])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data['email']
    password = serializer.validated_data['password']

    # Check if user already exists
    existing_user = User.objects.filter(email=email).first()
    if existing_user:
        if existing_user.is_verified:
            return Response(
                {'error': 'Account already exists'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Unverified user — reset password and resend code
        existing_user.set_password(password)
        existing_user.save()
        # Expire all previous verification codes
        existing_user.email_verifications.filter(is_used=False).update(is_used=True)
        _create_and_send_verification(existing_user)
        return Response({'message': 'Verification code sent'}, status=status.HTTP_200_OK)

    # Look up in ESI mock DB
    person, role = _lookup_esi_person(email)
    if person is None:
        return Response(
            {'error': 'Email not found in ESI database'},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Create unverified user
    user = User.objects.create_user(
        email=email,
        password=password,
        first_name=person.first_name,
        last_name=person.last_name,
        school_id=person.school_id,
        role=role,
        is_verified=False,
    )

    _create_and_send_verification(user)
    return Response({'message': 'Verification code sent'}, status=status.HTTP_200_OK)


@api_view(['POST'])
def verify_email(request):
    serializer = VerifyEmailSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data['email']
    code = serializer.validated_data['code']

    verification = (
        EmailVerification.objects
        .filter(user__email=email, code=code, is_used=False)
        .order_by('-created_at')
        .first()
    )

    if verification is None:
        return Response(
            {'error': 'Invalid verification code'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    is_valid, message = verification.is_valid()
    if not is_valid:
        return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)

    # Mark code as used and verify the user
    verification.is_used = True
    verification.save()

    user = verification.user
    user.is_verified = True
    user.is_active = True
    user.save()

    # Issue JWT tokens
    refresh = RefreshToken.for_user(user)
    response = Response(
        {
            'message': 'Email verified successfully',
            'access': str(refresh.access_token),
            'user': {
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'role': user.role,
            }
        },
        status=status.HTTP_200_OK,
    )
    _set_refresh_cookie(response, str(refresh))
    return response


@api_view(['POST'])
def resend_verification(request):
    serializer = ResendVerificationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data['email']

    user = User.objects.filter(email=email).first()
    if user is None:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if user.is_verified:
        return Response(
            {'error': 'Account is already verified'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Expire previous codes and send new one
    user.email_verifications.filter(is_used=False).update(is_used=True)
    _create_and_send_verification(user)
    return Response({'message': 'Verification code sent'}, status=status.HTTP_200_OK)


@api_view(['POST'])
def login(request):
    """Authenticates a verified user using email and password.
    Returns an access token and user info, while refresh lives in an HttpOnly cookie."""
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data['email']
    password = serializer.validated_data['password']

    # Check user exists
    user = User.objects.filter(email=email).first()
    if not user:
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Check email is verified
    if not user.is_verified:
        return Response(
            {'error': 'Email not verified'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Block banned/deactivated users from logging in
    if not user.is_active:
        return Response(
            {'error': 'Account is disabled'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Verify the password using the custom EmailBackend
    authenticated_user = authenticate(request, email=email, password=password)
    if not authenticated_user:
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Return access token + user object and persist refresh token in HttpOnly cookie.
    refresh = RefreshToken.for_user(authenticated_user)
    response = Response(
        {
            'access': str(refresh.access_token),
            'user': {
                'email': authenticated_user.email,
                'first_name': authenticated_user.first_name,
                'last_name': authenticated_user.last_name,
                'role': authenticated_user.role,
            }
        },
        status=status.HTTP_200_OK,
    )
    _set_refresh_cookie(response, str(refresh))
    return response


@api_view(['POST'])
def token_refresh(request):
    """Refresh access token using the HttpOnly refresh cookie."""
    refresh = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME)
    if not refresh:
        response = Response(
                {'detail': 'No refresh token cookie found.'},
                status=status.HTTP_401_UNAUTHORIZED
                )
        _clear_refresh_cookie(response)
        return response

    serializer = TokenRefreshSerializer(data={'refresh': refresh})
    try:
        serializer.is_valid(raise_exception=True)
    except Exception:
        response = Response(
                {'detail': 'Refresh token is invalid or expired.'},
                status=status.HTTP_401_UNAUTHORIZED
                )
        _clear_refresh_cookie(response)
        return response

    response = Response(serializer.validated_data, status=status.HTTP_200_OK)

    rotated_refresh = serializer.validated_data.get('refresh')
    if rotated_refresh:
        _set_refresh_cookie(response, rotated_refresh)

    return response


@api_view(['POST'])
def logout(request):
    """Clear refresh cookie and invalidate refresh token when possible."""
    refresh = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME)
    if refresh:
        try:
            token = RefreshToken(refresh)
            token.blacklist()
        except Exception:
            pass

    response = Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)
    _clear_refresh_cookie(response)
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """Return's the current authenticated user's basic informations"""
    user = request.user
    return Response({
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role,
    })


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile(request):
    """Return and update authenticated user profile (bio/avatar on Profile model)."""
    profile_obj, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == 'PATCH':
        update_serializer = ProfileUpdateSerializer(
            profile_obj,
            data=request.data,
            partial=True,
        )
        update_serializer.is_valid(raise_exception=True)
        update_serializer.save()
        request.user.refresh_from_db()

    serializer = UserProfileSerializer(request.user, context={'request': request})
    return Response(serializer.data)


def _build_public_profile_stats(user):
    return {
        'submissions_count': PersonalSubmission.objects.filter(
            owner=user,
            visibility=PersonalSubmission.Visibility.PUBLIC,
        ).count(),
        'questions_count': Question.objects.filter(author=user).count(),
        'answers_count': Answer.objects.filter(author=user).count(),
        'accepted_answers_count': Answer.objects.filter(
            author=user,
            is_accepted=True,
        ).count(),
    }


def _build_public_recent_activity(user):
    if user.role != User.Role.STUDENT:
        return {}

    return {
        'submissions': PersonalSubmission.objects.filter(
            owner=user,
            visibility=PersonalSubmission.Visibility.PUBLIC,
        ).order_by('-created_at')[:5],
        'questions': Question.objects.filter(author=user).order_by('-created_at')[:5],
        'answers': Answer.objects.select_related('question').filter(
            author=user,
        ).order_by('-created_at')[:5],
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_public(request, school_id):
    """Return a user's public profile by school_id."""
    user = get_object_or_404(User.objects.select_related('profile'), school_id=school_id)

    student_map = {}
    if user.role == User.Role.STUDENT and user.school_id:
        student = EsiStudent.objects.filter(school_id=user.school_id).first()
        if student is not None:
            student_map[user.school_id] = student

    serializer = PublicProfileSerializer(
        user,
        context={
            'request': request,
            'stats': _build_public_profile_stats(user),
            'recent_activity': _build_public_recent_activity(user),
            'student_map': student_map,
        },
    )
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_search(request):
    """Search verified users by name or school ID."""
    query = (request.query_params.get('q') or '').strip()
    if not query:
        return Response([])

    queryset = (
        User.objects.filter(is_verified=True)
        .select_related('profile')
        .filter(
            Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
            | Q(school_id__icontains=query)
        )
        .order_by('last_name', 'first_name', 'school_id')[:20]
    )

    school_ids = [user.school_id for user in queryset if user.school_id]
    student_map = {
        student.school_id: student
        for student in EsiStudent.objects.filter(school_id__in=school_ids)
    }

    serializer = ProfileSearchResultSerializer(
        queryset,
        many=True,
        context={'request': request, 'student_map': student_map},
    )
    return Response(serializer.data)


@api_view(['GET'])
def subject_list(request):
    """Return a list of all subjects. No auth required."""
    from .models import Subject
    subjects = Subject.objects.all().order_by('code')
    data = [{'id': s.id, 'name': s.name, 'code': s.code} for s in subjects]
    return Response(data)
