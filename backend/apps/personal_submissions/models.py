from django.conf import settings
from django.db import models


class PersonalSubmission(models.Model):
    SUBMISSION_TYPE_REVIEW = 'review'
    SUBMISSION_TYPE_HELP = 'help'
    SUBMISSION_TYPE_SHARING = 'sharing'
    SUBMISSION_TYPE_CHOICES = [
        (SUBMISSION_TYPE_REVIEW, 'Review'),
        (SUBMISSION_TYPE_HELP, 'Help'),
        (SUBMISSION_TYPE_SHARING, 'Sharing'),
    ]

    VISIBILITY_PUBLIC = 'public'
    VISIBILITY_PRIVATE = 'private'
    VISIBILITY_CHOICES = [
        (VISIBILITY_PUBLIC, 'Public'),
        (VISIBILITY_PRIVATE, 'Private'),
    ]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    language = models.CharField(max_length=50)
    course_tag = models.CharField(max_length=100, blank=True)
    submission_type = models.CharField(max_length=20, choices=SUBMISSION_TYPE_CHOICES)
    visibility = models.CharField(
        max_length=20,
        choices=VISIBILITY_CHOICES,
        default=VISIBILITY_PUBLIC,
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
        return self.title


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
