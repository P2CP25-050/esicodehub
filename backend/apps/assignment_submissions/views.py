"""Views for the assignment_submissions app."""
import io
import zipfile
import magic
from pathlib import PurePosixPath

from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import BaseRenderer, BrowsableAPIRenderer, JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.esi_db.models import EsiStudent
from apps.personal_submissions.gcs import (
    delete_directory,
    get_file_bytes,
    get_file_content,
    get_signed_url,
    upload_file,
)
from apps.personal_submissions.validators import validate_code_file
from .models import (
    Assignment,
    AssignmentSubmission,
    AssignmentSubmissionFile,
    ReviewComment,
    SubmissionReview,
)
from .serializers import (
    AssignmentCreateSerializer,
    AssignmentDetailSerializer,
    AssignmentListSerializer,
    AssignmentSubmissionDetailSerializer,
    AssignmentSubmissionListSerializer,
    ReviewCreateSerializer,
    SubmissionReviewSerializer,
)

MAX_FILE_SIZE = 10 * 1024 * 1024    # 10MB per file
MAX_TOTAL_SIZE = 50 * 1024 * 1024   # 50MB per submission


def assignment_matches_student_targeting(assignment, esi_student):
    """Return True when assignment targeting matches one ESI student."""
    if assignment.target_year != esi_student.study_year:
        return False

    if assignment.target_sections:
        section = (esi_student.section or '').strip()
        target_sections = {
            str(value).strip() for value in assignment.target_sections
        }
        if section not in target_sections:
            return False

    if assignment.target_groups:
        student_group = str(esi_student.group)
        target_groups = {
            str(value).strip() for value in assignment.target_groups
        }
        if student_group not in target_groups:
            return False

    return True


def student_is_targeted(assignment, user):
    """Return True when the given student user is targeted."""
    if user.role != 'student' or not user.school_id:
        return False

    try:
        esi_student = EsiStudent.objects.get(school_id=user.school_id)
    except EsiStudent.DoesNotExist:
        return False

    return assignment_matches_student_targeting(assignment, esi_student)


class AssignmentListPagination(PageNumberPagination):
    """Pagination used for assignments listing."""

    page_size = 20


class AssignmentListCreateView(APIView):
    """List assignments and allow professors to create assignments."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'professor':
            queryset = Assignment.objects.select_related(
                'subject',
                'professor',
            ).prefetch_related(
                'submissions',
            ).filter(professor=request.user)
            group_filter = request.query_params.get('group')

            if group_filter:
                group_value = group_filter.strip()
                if group_value:
                    group_filters = Q(target_groups__contains=[group_value])
                    if group_value.isdigit():
                        group_filters |= Q(target_groups__contains=[int(group_value)])
                    queryset = queryset.filter(group_filters)
        elif request.user.role == 'student':
            if not request.user.school_id:
                queryset = Assignment.objects.none()
            else:
                esi_student = EsiStudent.objects.filter(
                    school_id=request.user.school_id,
                ).first()

                if not esi_student:
                    queryset = Assignment.objects.none()
                else:
                    queryset = Assignment.objects.select_related(
                        'subject',
                        'professor',
                    ).prefetch_related(
                        'submissions',
                    ).filter(target_year=esi_student.study_year)
                    targeted_ids = [
                        assignment.id
                        for assignment in queryset
                        if assignment_matches_student_targeting(
                            assignment,
                            esi_student,
                        )
                    ]
                    queryset = queryset.filter(id__in=targeted_ids)
        else:
            return Response(
                {
                    'detail': (
                        'You do not have permission to perform this action.'
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        paginator = AssignmentListPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = AssignmentListSerializer(
            page,
            many=True,
            context={'request': request},
        )
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        if request.user.role != 'professor':
            return Response(
                {
                    'detail': (
                        'You do not have permission to perform this action.'
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AssignmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = serializer.save(professor=request.user)

        detail_serializer = AssignmentDetailSerializer(assignment)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)


class AssignmentDetailView(APIView):
    """Retrieve, update and delete a single assignment."""

    permission_classes = [IsAuthenticated]

    updatable_fields = {
        'title', 'description', 'deadline',
        'allow_late', 'description_pdf',
    }

    targeting_fields = {
        'target_year', 'target_sections',
        'target_groups', 'subject',
    }

    def get_object(self, pk):
        return get_object_or_404(
            Assignment.objects.select_related(
                'subject',
                'professor',
            ),
            pk=pk,
        )

    def get(self, request, pk):
        assignment = self.get_object(pk)

        if request.user.role == 'professor' or student_is_targeted(
            assignment,
            request.user,
        ):
            serializer = AssignmentDetailSerializer(assignment)
            return Response(serializer.data)

        return Response(
            {'detail': 'You do not have permission to perform this action.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    def patch(self, request, pk):
        assignment = self.get_object(pk)
        if assignment.professor != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        incoming_fields = set(request.data.keys())

        # Check targeting fields — only blocked after submissions exist
        changing_targets = incoming_fields & self.targeting_fields
        if changing_targets and assignment.submissions.exists():
            return Response(
                {
                    'detail': (
                        'Cannot change targeting fields after '
                        'students have submitted.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check for any completely unknown/disallowed fields
        all_allowed_fields = self.updatable_fields | self.targeting_fields
        disallowed_fields = incoming_fields - all_allowed_fields
        if disallowed_fields:
            return Response(
                {
                    'detail': (
                        f'Fields {", ".join(disallowed_fields)} cannot be updated.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AssignmentCreateSerializer(
            assignment,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        updated_assignment = serializer.save()
        detail_serializer = AssignmentDetailSerializer(updated_assignment)
        return Response(detail_serializer.data)

    def delete(self, request, pk):
        assignment = self.get_object(pk)

        if assignment.professor != request.user:
            return Response(
                {
                    'detail': (
                        'You do not have permission to perform this action.'
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        delete_directory(f'assignments/{assignment.id}/')
        assignment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SubmissionListPagination(PageNumberPagination):
    """Pagination used for submission listing."""
    page_size = 20


class StudentSubmitView(APIView):
    """
    Student submits files to an assignment.
    Supports resubmission, replaces previous files entirely.
    All DB operations are wrapped in a transaction.
    """
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _sanitize_and_validate_path(file_path: str) -> str:
        normalized = (file_path or '').replace('\\', '/').strip()
        if not normalized:
            raise serializers.ValidationError('File path cannot be empty')

        path_obj = PurePosixPath(normalized)
        if path_obj.is_absolute() or '..' in path_obj.parts:
            raise serializers.ValidationError(f'Invalid file path: {file_path}')

        return normalized

    def post(self, request, pk):
        # Students only
        if request.user.role != 'student':
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        assignment = get_object_or_404(
            Assignment.objects.select_related('professor', 'subject'),
            pk=pk,
        )

        # Check student is targeted by this assignment
        if not student_is_targeted(assignment, request.user):
            return Response(
                {'detail': 'You are not targeted by this assignment.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check assignment is open for submission
        if not assignment.is_open_for_submission():
            return Response(
                {'detail': 'This assignment is closed for submission.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        files = request.FILES.getlist('files')
        file_paths = request.POST.getlist('file_paths')

        if not files:
            return Response(
                {'detail': 'No files provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(files) != len(file_paths):
            return Response(
                {'detail': 'Number of files and file_paths must match.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Sanitize and validate all paths first
        try:
            sanitized_paths = [
                self._sanitize_and_validate_path(path)
                for path in file_paths
            ]
        except serializers.ValidationError as e:
            return Response(
                {'detail': e.detail[0] if isinstance(e.detail, list) else str(e.detail)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Validate each file
        for file in files:
            # Check individual file size
            if file.size > MAX_FILE_SIZE:
                return Response(
                    {'detail': f'{file.name} exceeds the 10MB per file limit.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check MIME type and extension
            try:
                validate_code_file(file)
            except serializers.ValidationError as e:
                return Response(
                    {'detail': e.detail[0]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # 3. Check total size
        incoming_total = sum(f.size for f in files)
        if incoming_total > MAX_TOTAL_SIZE:
            return Response(
                {'detail': 'Total submission size would exceed the 50MB limit.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_late = timezone.now() > assignment.deadline

        with transaction.atomic():
            # Get or create the submission record
            submission, created = AssignmentSubmission.objects.get_or_create(
                assignment=assignment,
                student=request.user,
                defaults={
                    'gcs_prefix': '',
                    'is_late': is_late,
                },
            )
            gcs_prefix = AssignmentSubmission.build_gcs_prefix(
                assignment.id,
                request.user.id,
                submission.id,
            )

            if not created:
                old_prefix = submission.gcs_prefix
                if old_prefix:
                    delete_directory(old_prefix)
                submission.files.all().delete()
                submission.is_late = is_late
                submission.gcs_prefix = gcs_prefix  # set both at once
                submission.save(update_fields=['gcs_prefix', 'is_late'])
            else:
                submission.gcs_prefix = gcs_prefix
                submission.save(update_fields=['gcs_prefix'])

            # Upload files and create records
            for file, file_path in zip(files, sanitized_paths):
                gcs_path = AssignmentSubmission.build_file_gcs_path(
                    assignment.id,
                    request.user.id,
                    submission.id,
                    file_path,
                )
                upload_file(file, gcs_path)

                AssignmentSubmissionFile.objects.create(
                    submission=submission,
                    file_name=file.name,
                    file_path=file_path,
                    gcs_path=gcs_path,
                    file_size=file.size,
                )

        submission.refresh_from_db()
        serializer = AssignmentSubmissionDetailSerializer(submission)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class StudentMySubmissionView(APIView):
    """Return the authenticated student's own submission for an assignment."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if request.user.role != 'student':
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        assignment = get_object_or_404(Assignment, pk=pk)

        submission = get_object_or_404(
            AssignmentSubmission.objects.prefetch_related('files', 'reviews'),
            assignment=assignment,
            student=request.user,
        )

        serializer = AssignmentSubmissionDetailSerializer(submission)
        return Response(serializer.data)


class ProfessorSubmissionListView(APIView):
    """
    List all submissions for an assignment.
    Any professor can access not just the creator.
    Supports optional group filter.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if request.user.role != 'professor':
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        assignment = get_object_or_404(Assignment, pk=pk)

        queryset = AssignmentSubmission.objects.filter(
            assignment=assignment,
        ).select_related('student').prefetch_related(
                'files', 'reviews').order_by('-submitted_at', '-id')

        # Optional group filter
        group_filter = request.query_params.get('group')
        if group_filter:
            group_value = group_filter.strip()
            student_ids = [sub.student.school_id for sub in queryset]
            matching_school_ids = set(
                EsiStudent.objects.filter(
                    school_id__in=student_ids,
                    group=group_value,
                ).values_list('school_id', flat=True)
            )
            queryset = [
                sub for sub in queryset
                if sub.student.school_id in matching_school_ids
            ]

        paginator = SubmissionListPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = AssignmentSubmissionListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @staticmethod
    def _student_in_group(user, group_value, assignment):
        """Check if the student belongs to the requested group."""
        from apps.esi_db.models import EsiStudent
        try:
            esi_student = EsiStudent.objects.get(school_id=user.school_id)
            return str(esi_student.group) == group_value
        except EsiStudent.DoesNotExist:
            return False


class AssignmentSubmissionsDownloadView(APIView):
    """Download all submissions for an assignment as a zip archive."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if request.user.role != 'professor':
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        assignment = get_object_or_404(
            Assignment.objects.select_related('professor'),
            pk=pk,
        )

        if assignment.professor != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        submissions = (
            AssignmentSubmission.objects.filter(assignment=assignment)
            .select_related('student')
            .prefetch_related('files')
            .order_by('id')
        )

        if not submissions.exists():
            return Response(
                {'error': 'No submissions yet.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        buffer = io.BytesIO()
        name_counts = {}
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for submission in submissions:
                student_school_id = (
                    submission.student.school_id
                    or str(submission.student.id)
                )
                for submission_file in submission.files.all():
                    ext = PurePosixPath(
                        submission_file.file_path or submission_file.file_name
                    ).suffix
                    if not ext:
                        ext = PurePosixPath(submission_file.file_name).suffix
                    if not ext:
                        ext = '.txt'

                    base = f'{student_school_id}_{submission.id}'
                    base_key = f'{base}{ext}'
                    count = name_counts.get(base_key, 0)
                    filename = (
                        f'{base}_{count + 1}{ext}' if count else base_key
                    )
                    name_counts[base_key] = count + 1

                    content = get_file_bytes(submission_file.gcs_path)
                    zf.writestr(filename, content)

        buffer.seek(0)
        safe_title = (
            assignment.title.replace('"', "'")
            .replace('/', '-')
            .replace('\\', '-')
            .strip()
        )
        if not safe_title:
            safe_title = f'assignment-{assignment.id}'
        zip_name = f'{safe_title}_submissions.zip'

        response = HttpResponse(buffer.read(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{zip_name}"'
        return response


class ProfessorSubmissionDetailView(APIView):
    """Full submission detail with files and all reviews. Any professor."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk, submission_id):
        if request.user.role != 'professor':
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        get_object_or_404(Assignment, pk=pk)

        submission = get_object_or_404(
            AssignmentSubmission.objects.prefetch_related('files', 'reviews'),
            id=submission_id,
            assignment_id=pk,
        )

        serializer = AssignmentSubmissionDetailSerializer(submission)
        return Response(serializer.data)


class SubmissionFileContentView(APIView):
    """Return raw text content of a submission file. Any professor."""

    permission_classes = [IsAuthenticated]

    class PlainTextRenderer(BaseRenderer):
        media_type = 'text/plain'
        format = 'txt'
        charset = 'utf-8'
        render_style = 'text'

        def render(self, data, accepted_media_type=None, renderer_context=None):
            if data is None:
                return b''
            if isinstance(data, bytes):
                return data
            return str(data).encode(self.charset)

    renderer_classes = [PlainTextRenderer, JSONRenderer, BrowsableAPIRenderer]

    def get(self, request, pk, submission_id, file_id):
        if request.user.role != 'professor':
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        get_object_or_404(Assignment, pk=pk)

        submission = get_object_or_404(
            AssignmentSubmission,
            id=submission_id,
            assignment_id=pk,
        )

        file = get_object_or_404(
            AssignmentSubmissionFile,
            id=file_id,
            submission=submission,
        )

        try:
            content = get_file_content(file.gcs_path)
            return HttpResponse(
                content,
                content_type='text/plain; charset=utf-8',
            )
        except UnicodeDecodeError:
            return Response(
                {'detail': 'File is binary and cannot be displayed as text.'},
                status=status.HTTP_400_BAD_REQUEST,
            )


class SubmissionReviewView(APIView):
    """
    POST: Professor creates or fully replaces their review of a submission.
    GET: Professor or the submitting student sees all reviews.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk, submission_id):
        # Professor or the submitting student can view reviews
        get_object_or_404(Assignment, pk=pk)

        submission = get_object_or_404(
            AssignmentSubmission,
            id=submission_id,
            assignment_id=pk,
        )

        is_professor = request.user.role == 'professor'
        is_submitting_student = (
            request.user.role == 'student'
            and submission.student == request.user
        )

        if not is_professor and not is_submitting_student:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        reviews = submission.reviews.select_related('professor').prefetch_related('comments').all()
        serializer = SubmissionReviewSerializer(reviews, many=True)
        return Response(serializer.data)

    def post(self, request, pk, submission_id):
        if request.user.role != 'professor':
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        get_object_or_404(Assignment, pk=pk)

        submission = get_object_or_404(
            AssignmentSubmission,
            id=submission_id,
            assignment_id=pk,
        )

        serializer = ReviewCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        general_comment = serializer.validated_data['general_comment']
        grade = serializer.validated_data.get('grade')
        comments_data = serializer.validated_data['comments']

        with transaction.atomic():
            # Get or create this professor's review
            review, _ = SubmissionReview.objects.update_or_create(
                submission=submission,
                professor=request.user,
                defaults={
                    'general_comment': general_comment,
                    'grade': grade,
                },
            )

            # Fully replace all existing comments
            review.comments.all().delete()

            # Create new comment records
            for comment in comments_data:
                file = get_object_or_404(
                    AssignmentSubmissionFile,
                    id=comment['file_id'],
                    submission=submission,
                )
                ReviewComment.objects.create(
                    review=review,
                    file=file,
                    line_number=comment['line_number'],
                    content=comment['content'],
                )

        review.refresh_from_db()
        response_serializer = SubmissionReviewSerializer(review)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class AssignmentDescriptionPDFUploadView(APIView):
    """
    Upload a PDF file as the assignment description.
    Professor only must be the assignment creator.
    Validates MIME type is application/pdf only.
    Stores at assignments/{assignment_id}/description.pdf in GCS.
    Returns a signed URL valid for 7 days.
    """

    permission_classes = [IsAuthenticated]

    # 7 days in seconds
    SIGNED_URL_EXPIRATION = 7 * 24 * 60 * 60

    def post(self, request, pk):
        # Professor only
        if request.user.role != 'professor':
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        assignment = get_object_or_404(
            Assignment.objects.select_related('professor'),
            pk=pk,
        )

        # Only the professor who created it can upload
        if assignment.professor != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Cannot upload after deadline
        if assignment.deadline < timezone.now():
            return Response(
                {'detail': 'Cannot edit an assignment after its deadline has passed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file = request.FILES.get('file')
        if not file:
            return Response(
                {'detail': 'No file provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate MIME type is application/pdf only
        file_content = file.read(2048)
        file.seek(0)
        mime_type = magic.from_buffer(file_content, mime=True)

        if mime_type != 'application/pdf':
            return Response(
                {'detail': f'Only PDF files are allowed. Detected: {mime_type}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build GCS path and upload
        gcs_path = f'assignments/{assignment.id}/description.pdf'
        upload_file(file, gcs_path)

        # Save GCS path to the assignment
        assignment.description_pdf = gcs_path
        assignment.save(update_fields=['description_pdf'])

        # Return signed URL valid for 7 days
        signed_url = get_signed_url(gcs_path, expiration=self.SIGNED_URL_EXPIRATION)
        return Response(
            {'url': signed_url},
            status=status.HTTP_200_OK,
        )


class AssignmentDescriptionPDFView(APIView):
    """Serve assignment description PDF bytes for authenticated users."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        assignment = get_object_or_404(
            Assignment.objects.select_related('professor', 'subject'),
            pk=pk,
        )

        if request.user.role == 'professor':
            if assignment.professor != request.user:
                return Response(
                    {'detail': 'You do not have permission to perform this action.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif request.user.role == 'student':
            if not student_is_targeted(assignment, request.user):
                return Response(
                    {'detail': 'You do not have permission to perform this action.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not assignment.description_pdf:
            return Response(
                {'detail': 'No PDF description is available for this assignment.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            content = get_file_bytes(assignment.description_pdf)
        except Exception:
            return Response(
                {'detail': 'Unable to retrieve assignment PDF.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        filename = f'assignment-{assignment.id}-description.pdf'
        download = request.query_params.get('download') == '1'
        disposition = 'attachment' if download else 'inline'

        response = HttpResponse(content, content_type='application/pdf')
        response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
        return response
