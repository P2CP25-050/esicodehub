from django.conf import settings
from django.db import models


class PersonalSubmission(models.Model):

    class SubmissionType(models.TextChoices):
        REVIEW = 'review', 'Review'
        HELP = 'help', 'Help'
        SHARING = 'sharing', 'Sharing'

    class Visibility(models.TextChoices):
        PUBLIC = 'public', 'Public'
        PRIVATE = 'private', 'Private'

    owner = models.ForeignKey(
            settings.AUTH_USER_MODEL,
            on_delete=models.CASCADE,
            related_name='personal_submissions'
        )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    language = models.CharField(max_length=50)
    course_tag = models.CharField(max_length=100, blank=True)
    submission_type = models.CharField(max_length=20, choices=SubmissionType.choices)
    visibility = models.CharField(
        max_length=10,
        choices=Visibility.choices,
        default=Visibility.PUBLIC,
    )
    gcs_prefix = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'personal_submissions'
        ordering = ['-created_at']

    @staticmethod
    def build_gcs_prefix(user_id, submission_id):
        return f'personal/{user_id}/{submission_id}/'

    @staticmethod
    def build_file_gcs_path(user_id, submission_id, file_path):
        return f'personal/{user_id}/{submission_id}/{file_path}'

    def __str__(self):
        return f"{self.title} by {self.owner.email}"


class PersonalSubmissionFile(models.Model):
    submission = models.ForeignKey(
        PersonalSubmission,
        on_delete=models.CASCADE,
        related_name='files',
    )
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    gcs_path = models.CharField(max_length=1000)
    file_size = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'personal_submission_files'

    def __str__(self):
        return self.file_name


class SubmissionComment(models.Model):
    submission = models.ForeignKey(
        PersonalSubmission,
        on_delete=models.CASCADE,
        related_name='comments',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )
    line_number = models.PositiveIntegerField()
    body = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'personal_submission_comments'
        ordering = ['line_number', 'created_at']

    def __str__(self):
        return f"Comment by {self.author.email} on line {self.line_number}"
