from django.db import transaction
from django.http import HttpResponse
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status, serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .gcs import delete_directory, upload_file, delete_file, get_file_content
from .models import PersonalSubmission, PersonalSubmissionFile
from .serializers import (
    PersonalSubmissionFileSerializer,
    PersonalSubmissionCreateSerializer,
    PersonalSubmissionDetailSerializer,
    PersonalSubmissionListSerializer,
)
from .validators import validate_code_file

# File size limits in bytes
MAX_FILE_SIZE = 10 * 1024 * 1024    # 10MB per file
MAX_TOTAL_SIZE = 50 * 1024 * 1024   # 50MB per submission


class PersonalSubmissionListCreateView(APIView):
    """List public submissions and create new personal submissions."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = PersonalSubmission.objects.select_related('owner').prefetch_related(
            'files'
        )

        queryset = queryset.filter(
            Q(visibility=PersonalSubmission.Visibility.PUBLIC)
            | Q(owner=request.user)
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

    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        return get_object_or_404(
            PersonalSubmission.objects.select_related('owner').prefetch_related('files'),
            pk=pk,
        )

    def get(self, request, pk):
        submission = self.get_object(pk)
        is_public = submission.visibility == PersonalSubmission.Visibility.PUBLIC
        is_owner = submission.owner == request.user

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


class FileUploadView(APIView):
    """Upload one or more files to a submission. Auth required (owner only)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        submission = get_object_or_404(
            PersonalSubmission.objects.select_related('owner'),
            pk=pk,
        )

        # Only the owner can upload files
        if submission.owner != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        files = request.FILES.getlist('files')
        file_paths = request.POST.getlist('file_paths')

        if not files:
            return Response(
                {'detail': 'No files provided'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(files) != len(file_paths):
            # Reject paths with directory traversal attempts
            for file_path in file_paths:
                if '..' in file_path or file_path.startswith('/'):
                    return Response(
                        {'detail': f'Invalid file path: {file_path}'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            return Response(
                {'detail': 'Number of files and file_paths must match'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate each file before doing anything
        for file in files:
            # Check individual file size
            if file.size > MAX_FILE_SIZE:
                return Response(
                    {'detail': f'{file.name} exceeds the 10MB per file limit'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check file extension and MIME type through the validator
            try:
                validate_code_file(file)
            except serializers.ValidationError as e:
                return Response(
                    {'detail': e.detail[0]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Check total submission size won't exceed 50MB
        current_total = sum(f.file_size for f in submission.files.all())
        incoming_total = sum(f.size for f in files)
        if current_total + incoming_total > MAX_TOTAL_SIZE:
            return Response(
                {'detail': 'Total submission size would exceed the 50MB limit'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # All validations passed, upload and create records
        created_files = []
        with transaction.atomic():
            for file, file_path in zip(files, file_paths):
                gcs_path = PersonalSubmission.build_file_gcs_path(
                    request.user.id,
                    submission.id,
                    file_path,
                )
                upload_file(file, gcs_path)
                submission_file = PersonalSubmissionFile.objects.create(
                    submission=submission,
                    file_name=file.name,
                    file_path=file_path,
                    gcs_path=gcs_path,
                    file_size=file.size,
                )
                created_files.append(submission_file)

        serializer = PersonalSubmissionFileSerializer(created_files, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FileDeleteView(APIView):
    """Delete a single file from a submission. Auth required (owner only)."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, file_id):
        submission = get_object_or_404(
            PersonalSubmission.objects.select_related('owner'),
            pk=pk,
        )

        # Only the owner can delete files
        if submission.owner != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        file = get_object_or_404(
            PersonalSubmissionFile,
            id=file_id,
            submission=submission,
        )

        # Delete from GCS then remove the database record
        delete_file(file.gcs_path)
        file.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class FileContentView(APIView):
    """
    Retrieve raw text content of a file.
     -Public submissions: no auth required
     -Private submissions: owner only
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk, file_id):
        submission = get_object_or_404(
            PersonalSubmission.objects.select_related('owner'),
            pk=pk,
        )

        # Private submissions are only accessible by the owner
        is_public = submission.visibility == PersonalSubmission.Visibility.PUBLIC
        is_owner = submission.owner == request.user

        if not is_public and not is_owner:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        file = get_object_or_404(
            PersonalSubmissionFile,
            id=file_id,
            submission=submission,
        )

        try:
            content = get_file_content(file.gcs_path)
            return HttpResponse(content, content_type='text/plain; charset=utf-8')
        except UnicodeDecodeError:
            return Response(
                {'detail': 'File is binary and cannot be displayed as text'},
                status=status.HTTP_400_BAD_REQUEST,
            )
