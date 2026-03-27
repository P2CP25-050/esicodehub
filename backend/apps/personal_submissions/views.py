from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .gcs import delete_directory
from .models import PersonalSubmission
from .serializers import (
    PersonalSubmissionCreateSerializer,
    PersonalSubmissionDetailSerializer,
    PersonalSubmissionListSerializer,
)


class PersonalSubmissionListCreateView(APIView):
    """List public submissions and create new personal submissions."""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request):
        queryset = PersonalSubmission.objects.select_related('owner').prefetch_related(
            'files'
        )

        if request.user.is_authenticated:
            queryset = queryset.filter(
                Q(visibility=PersonalSubmission.Visibility.PUBLIC)
                | Q(owner=request.user)
            )
        else:
            queryset = queryset.filter(
                visibility=PersonalSubmission.Visibility.PUBLIC
            )

        language = request.query_params.get('language')
        submission_type = request.query_params.get('type')
        course = request.query_params.get('course')
        search = request.query_params.get('search')

        if language:
            queryset = queryset.filter(language__iexact=language.strip())
        if submission_type:
            queryset = queryset.filter(
                submission_type__iexact=submission_type.strip()
            )
        if course:
            queryset = queryset.filter(course_tag__iexact=course.strip())
        if search:
            queryset = queryset.filter(title__icontains=search.strip())

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = PersonalSubmissionListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = PersonalSubmissionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        submission = serializer.save(owner=request.user, gcs_prefix='')
        submission.gcs_prefix = PersonalSubmission.build_gcs_prefix(
            request.user.id,
            submission.id,
        )
        submission.save(update_fields=['gcs_prefix'])

        detail_serializer = PersonalSubmissionDetailSerializer(submission)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)


class PersonalSubmissionDetailView(APIView):
    """Retrieve, update, and delete a personal submission."""

    updatable_fields = {
        'title',
        'description',
        'language',
        'course_tag',
        'submission_type',
        'visibility',
    }

    def get_permissions(self):
        if self.request.method in ('PATCH', 'DELETE'):
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_object(self, pk):
        return get_object_or_404(
            PersonalSubmission.objects.select_related('owner').prefetch_related('files'),
            pk=pk,
        )

    def get(self, request, pk):
        submission = self.get_object(pk)
        is_public = submission.visibility == PersonalSubmission.Visibility.PUBLIC
        is_owner = request.user.is_authenticated and submission.owner == request.user

        if not is_public and not is_owner:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PersonalSubmissionDetailSerializer(submission)
        return Response(serializer.data)

    def patch(self, request, pk):
        submission = self.get_object(pk)
        if submission.owner != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        disallowed_fields = set(request.data.keys()) - self.updatable_fields
        if disallowed_fields:
            return Response(
                {
                    'detail': (
                        'Only title, description, language, course_tag, '
                        'submission_type, visibility can be updated.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PersonalSubmissionCreateSerializer(
            submission,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        submission.refresh_from_db()

        detail_serializer = PersonalSubmissionDetailSerializer(submission)
        return Response(detail_serializer.data)

    def delete(self, request, pk):
        submission = self.get_object(pk)
        if submission.owner != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        delete_directory(submission.gcs_prefix)
        submission.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)