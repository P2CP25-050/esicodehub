from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator
from django.db import models


class PlagiarismReport(models.Model):
    """Stores one plagiarism detection run for a single assignment."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETE = 'complete', 'Complete'
        FAILED = 'failed', 'Failed'

    assignment = models.OneToOneField(
        'assignment_submissions.Assignment',
        on_delete=models.CASCADE,
        related_name='plagiarism_report',
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    triggered_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    moss_urls = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'plagiarism_reports'

    def __str__(self):
        return f'Plagiarism report for assignment {self.assignment_id}'


class SimilarityMatch(models.Model):
    """Stores one pairwise similarity result from a MOSS report."""

    report = models.ForeignKey(
        PlagiarismReport,
        on_delete=models.CASCADE,
        related_name='matches',
    )
    submission_a = models.ForeignKey(
        'assignment_submissions.AssignmentSubmission',
        on_delete=models.CASCADE,
        related_name='similarity_matches_as_a',
        null=True,
        blank=True,
    )
    submission_b = models.ForeignKey(
        'assignment_submissions.AssignmentSubmission',
        on_delete=models.CASCADE,
        related_name='similarity_matches_as_b',
        null=True,
        blank=True,
    )
    language = models.CharField(max_length=50)
    similarity_a = models.PositiveSmallIntegerField(validators=[MaxValueValidator(100)])
    similarity_b = models.PositiveSmallIntegerField(validators=[MaxValueValidator(100)])
    lines_matched = models.PositiveIntegerField()
    moss_link = models.URLField()
    ai_moss_flag = models.BooleanField(default=False)

    class Meta:
        db_table = 'similarity_matches'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(submission_a__lt=models.F('submission_b')),
                name='similarity_match_submission_order',
            ),
            models.CheckConstraint(
                condition=models.Q(similarity_a__lte=100),
                name='similarity_a_lte_100',
            ),
            models.CheckConstraint(
                condition=models.Q(similarity_b__lte=100),
                name='similarity_b_lte_100',
            ),
            models.UniqueConstraint(
                fields=['report', 'submission_a', 'submission_b', 'language'],
                condition=models.Q(ai_moss_flag=False),
                name='unique_similarity_pair_per_language',
            ),
        ]

    def clean(self):
        errors = {}

        if self.submission_a_id and self.submission_b_id and (
                self.submission_a_id == self.submission_b_id):
            errors['submission_b'] = 'submission_b must be different from submission_a.'

        report_assignment_id = getattr(
                self.report,
                'assignment_id',
                None) if self.report_id else None

        if report_assignment_id and self.submission_a_id:
            if self.submission_a.assignment_id != report_assignment_id:
                errors['submission_a'] = 'submission_a must belong to the report assignment.'

        if report_assignment_id and self.submission_b_id:
            if self.submission_b.assignment_id != report_assignment_id:
                errors['submission_b'] = 'submission_b must belong to the report assignment.'

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.language:
            self.language = self.language.strip().lower()

        if self.submission_a_id and self.submission_b_id and (
                self.submission_a_id > self.submission_b_id):
            self.submission_a, self.submission_b = self.submission_b, self.submission_a
            self.similarity_a, self.similarity_b = self.similarity_b, self.similarity_a

        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def max_similarity(self):
        return max(self.similarity_a, self.similarity_b)

    def __str__(self):
        return (
            f'Match {self.submission_a_id} vs {self.submission_b_id} '
            f'({self.language}: {self.max_similarity}%)'
        )


class AIReferenceSubmission(models.Model):
    """Stores one AI-generated reference solution for an assignment."""

    assignment = models.ForeignKey(
        'assignment_submissions.Assignment',
        on_delete=models.CASCADE,
        related_name='ai_references',
    )
    language = models.CharField(max_length=50)

    # verbose, minimal, beginner, structured
    style = models.CharField(max_length=50)

    gcs_path = models.CharField(max_length=1000)
    file_name = models.CharField(max_length=255)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_reference_submissions'

    @staticmethod
    def build_gcs_path(
        assignment_id: int,
        language: str,
        style: str,
        ext: str,
    ) -> str:
        """Build the GCS path for an AI reference file."""
        return f"assignments/{assignment_id}/ai_reference/{language}_{style}.{ext}"

    def __str__(self):
        return f"AI reference for assignment {self.assignment_id} ({self.language} — {self.style})"
