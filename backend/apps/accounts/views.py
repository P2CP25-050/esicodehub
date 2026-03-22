from django.core.mail import send_mail
from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, EmailVerification
from accounts.serializers import (
    RegisterSerializer,
    VerifyEmailSerializer,
    ResendVerificationSerializer,
    LoginSerializer
)
from esi_db.models import EsiStudent, EsiProfessor


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
    send_mail(
        subject='ESI Code Hub – Email Verification',
        message=f'Your verification code is: {code}',
        from_email=None,  # uses DEFAULT_FROM_EMAIL
        recipient_list=[user.email],
    )


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
    return Response(
        {
            'message': 'Email verified successfully',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'role': user.role,
            }
        },
        status=status.HTTP_200_OK,
    )


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
    Returns JWT access and refresh tokens along with basic user info."""
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

    # Return tokens + user object
    refresh = RefreshToken.for_user(authenticated_user)
    return Response(
        {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'email': authenticated_user.email,
                'first_name': authenticated_user.first_name,
                'last_name': authenticated_user.last_name,
                'role': authenticated_user.role,
            }
        },
        status=status.HTTP_200_OK,
    )


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
