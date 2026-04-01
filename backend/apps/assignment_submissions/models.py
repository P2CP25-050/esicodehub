from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Assignment(models.Model):
    """Represents an assignment created by a professor."""

    class TargetYear(models.TextChoices):
        """Academic year targets allowed for an assignment."""

        FIRST_CP = '1CP', '1CP'
        SECOND_CP = '2CP', '2CP'
        FIRST_CS = '1CS', '1CS'
        SECOND_CS = '2CS', '2CS'
        THIRD_CS = '3CS', '3CS'

    professor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='assignments',
        on_delete=models.CASCADE,
    )
    subject = models.ForeignKey('accounts.Subject', on_delete=models.PROTECT)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    target_year = models.CharField(max_length=3, choices=TargetYear.choices)
    target_sections = models.JSONField(default=list, blank=True)
    target_groups = models.JSONField(default=list, blank=True)
    deadline = models.DateTimeField()
    allow_late = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'assignments'
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                name='assignment_target_year_valid',
                condition=models.Q(target_year__in=['1CP', '2CP', '1CS', '2CS', '3CS']),
            ),
        ]

    def clean(self):
        """Validate mutually exclusive targeting between sections and groups."""
        if self.target_sections and self.target_groups:
            raise ValidationError(
                'target_sections and target_groups are mutually exclusive. Set only one.'
            )

    def is_open_for_submission(self):
        """Return True when the assignment accepts submissions at the current time."""
        from django.utils import timezone

        if timezone.now() <= self.deadline:
            return True
        return self.allow_late


class AssignmentSubmission(models.Model):
    """Stores a student's submission metadata for one assignment."""

    assignment = models.ForeignKey(
        Assignment,
        related_name='submissions',
        on_delete=models.CASCADE,
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='assignment_submissions',
        on_delete=models.CASCADE,
    )
    gcs_prefix = models.CharField(max_length=500)
    submitted_at = models.DateTimeField(auto_now=True)
    is_late = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'assignment_submissions'
        unique_together = [['assignment', 'student']]

    @staticmethod
    def build_gcs_prefix(assignment_id, student_id, submission_id):
        """Build the base GCS prefix for one submission."""
        return f'assignments/{assignment_id}/{student_id}/{submission_id}/'

    @staticmethod
    def build_file_gcs_path(assignment_id, student_id, submission_id, file_path):
        """Build the full GCS path for a file inside one submission."""
        return f'assignments/{assignment_id}/{student_id}/{submission_id}/{file_path}'


class AssignmentSubmissionFile(models.Model):
    """Represents a single file included in an assignment submission."""

    submission = models.ForeignKey(
        AssignmentSubmission,
        related_name='files',
        on_delete=models.CASCADE,
    )
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    gcs_path = models.CharField(max_length=1000)
    file_size = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'assignment_submission_files'


class SubmissionReview(models.Model):
    """Stores a professor's review for a submission."""

    submission = models.ForeignKey(
        AssignmentSubmission,
        related_name='reviews',
        on_delete=models.CASCADE,
    )
    professor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='reviews_given',
        on_delete=models.CASCADE,
    )
    general_comment = models.TextField(blank=True)
    grade = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'submission_reviews'
        unique_together = [['submission', 'professor']]


class ReviewComment(models.Model):
    """Stores an inline comment linked to a reviewed submission file line."""

    review = models.ForeignKey(
        SubmissionReview,
        related_name='comments',
        on_delete=models.CASCADE,
    )
    file = models.ForeignKey(AssignmentSubmissionFile, on_delete=models.CASCADE)
    line_number = models.PositiveIntegerField()
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'review_comments'
