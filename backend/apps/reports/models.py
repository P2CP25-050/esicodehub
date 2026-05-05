from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta


class ReportStatus(models.TextChoices):
    OPEN = 'open', 'Open'
    REVIEWED = 'reviewed', 'Reviewed'
    RESOLVED = 'resolved', 'Resolved'
    DISMISSED = 'dismissed', 'Dismissed'


class UserReport(models.Model):
    class Reason(models.TextChoices):
        SPAM = 'spam', 'Spam or irrelevant content'
        HARASSMENT = 'harassment', 'Harassment or bullying'
        IMPERSONATION = 'impersonation', 'Impersonation'
        ACADEMIC_DISHONESTY = 'academic_dishonesty', 'Academic dishonesty'
        OTHER = 'other', 'Other'

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='reports_submitted'
    )
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='reports_received'
    )
    reason = models.CharField(max_length=32, choices=Reason.choices)
    description = models.TextField(blank=True, max_length=1000)
    status = models.CharField(
        max_length=16, choices=ReportStatus.choices,
        default=ReportStatus.OPEN
    )
    admin_note = models.TextField(
        blank=True,
        help_text="Internal note visible only in admin — not shown to users."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_reports'
        ordering = ['-created_at']
        verbose_name = 'User Report'
        verbose_name_plural = 'User Reports'

    def __str__(self):
        return (
            f"{self.reporter.email} reported {self.reported_user.email}"
            f" for {self.reason}"
        )

    @staticmethod
    def check_rate_limit(reporter) -> bool:
        """Returns True if reporter is within the allowed limit (max 5 per 24h)."""
        cutoff = timezone.now() - timedelta(hours=24)
        count = UserReport.objects.filter(
            reporter=reporter,
            created_at__gte=cutoff
        ).count()
        return count < 5

    @staticmethod
    def has_open_duplicate(reporter, reported_user, reason) -> bool:
        """Returns True if an identical open report already exists."""
        return UserReport.objects.filter(
            reporter=reporter,
            reported_user=reported_user,
            reason=reason,
            status=ReportStatus.OPEN
        ).exists()


class ProblemReport(models.Model):
    class Category(models.TextChoices):
        BUG = 'bug', 'Bug / something is broken'
        UI_ISSUE = 'ui_issue', 'UI / display issue'
        WRONG_DATA = 'wrong_data', 'Wrong or missing data'
        MISSING_FEATURE = 'missing_feature', 'Missing feature or suggestion'
        OTHER = 'other', 'Other'

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='problem_reports'
    )
    category = models.CharField(max_length=32, choices=Category.choices)
    title = models.CharField(max_length=200)
    description = models.TextField(max_length=2000)
    page_url = models.CharField(
        max_length=500, blank=True,
        help_text="The page path where the problem occurred (e.g. /forum/12)."
    )
    status = models.CharField(
        max_length=16, choices=ReportStatus.choices,
        default=ReportStatus.OPEN
    )
    admin_note = models.TextField(
        blank=True,
        help_text="Internal note visible only in admin — not shown to users."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'problem_reports'
        ordering = ['-created_at']
        verbose_name = 'Problem Report'
        verbose_name_plural = 'Problem Reports'

    def __str__(self):
        return f"[{self.category}] {self.title} — {self.reporter.email}"
