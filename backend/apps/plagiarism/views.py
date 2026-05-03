"""Views for plagiarism reports."""

from django.db.models import Count, Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assignment_submissions.models import Assignment
from .models import AIReferenceSubmission, PlagiarismReport, SimilarityMatch
from .serializers import PlagiarismReportSerializer
from .tasks import generate_ai_references, run_plagiarism_check


class PlagiarismReportRunView(APIView):
    """Trigger a plagiarism report for an assignment."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """Queue a plagiarism check after validation."""
        if request.user.role != 'professor':
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        assignment = get_object_or_404(Assignment, pk=pk)

        if assignment.deadline > timezone.now():
            return Response(
                {
                    'detail': (
                        'Plagiarism check can only be run after the assignment '
                        'deadline has passed.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not assignment.languages:
            return Response(
                {
                    'detail': (
                        'This assignment has no languages configured. Add at '
                        'least one language before running a check.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        report = PlagiarismReport.objects.filter(assignment=assignment).first()
        if report:
            if report.status in (
                PlagiarismReport.Status.PENDING,
                PlagiarismReport.Status.RUNNING,
            ):
                return Response(
                    {'detail': 'A check is already in progress.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            SimilarityMatch.objects.filter(report=report).delete()
            report.status = PlagiarismReport.Status.PENDING
            report.triggered_by = request.user
            report.triggered_at = timezone.now()
            report.completed_at = None
            report.error_message = ''
            report.moss_urls = {}
            report.triggered_at = timezone.now()
            report.save(
                update_fields=[
                    'status',
                    'triggered_by',
                    'triggered_at',
                    'completed_at',
                    'error_message',
                    'moss_urls',
                ]
            )
        else:
            report = PlagiarismReport.objects.create(
                assignment=assignment,
                triggered_by=request.user,
            )

        run_plagiarism_check.delay(report.id)

        return Response(
            {'report_id': report.id, 'status': report.status},
            status=status.HTTP_202_ACCEPTED,
        )


class PlagiarismReferenceGenerateView(APIView):
    """Trigger AI reference generation for an assignment."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """Queue AI reference generation after validation."""
        if request.user.role != 'professor':
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        assignment = get_object_or_404(Assignment, pk=pk)

        if not assignment.languages:
            return Response(
                {
                    'detail': (
                        'This assignment has no languages configured. Add at '
                        'least one language before generating references.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        generate_ai_references.delay(assignment.id)

        return Response(
            {
                'status': 'generating',
                'message': 'AI references are being generated.',
            },
            status=status.HTTP_202_ACCEPTED,
        )


class PlagiarismReferenceStatusView(APIView):
    """Return AI reference generation status for an assignment."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Return AI reference counts per language and latest timestamp."""
        if request.user.role != 'professor':
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        assignment = get_object_or_404(Assignment, pk=pk)
        references = AIReferenceSubmission.objects.filter(assignment=assignment)

        if not references.exists():
            return Response({'has_references': False, 'references': {}})

        counts = (
            references.values('language')
            .annotate(count=Count('id'))
            .order_by('language')
        )
        references_by_language = {
            item['language']: item['count']
            for item in counts
        }
        latest_reference = references.order_by('-generated_at').first()

        return Response(
            {
                'has_references': True,
                'references': references_by_language,
                'generated_at': latest_reference.generated_at,
            }
        )


class PlagiarismReportDetailView(APIView):
    """Retrieve the plagiarism report and its matches."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Return report details for a single assignment."""
        if request.user.role != 'professor':
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        assignment = get_object_or_404(Assignment, pk=pk)
        matches_qs = SimilarityMatch.objects.select_related(
            'submission_a__student',
            'submission_b__student',
        )
        try:
            report = PlagiarismReport.objects.select_related(
                'triggered_by'
            ).prefetch_related(
                Prefetch('matches', queryset=matches_qs),
            ).get(assignment=assignment)
        except PlagiarismReport.DoesNotExist:
            return Response(
                {'detail': 'No plagiarism report found for this assignment.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = PlagiarismReportSerializer(report)
        return Response(serializer.data)
