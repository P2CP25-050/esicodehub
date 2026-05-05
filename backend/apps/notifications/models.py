from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Type(models.TextChoices):
        FORUM_ANSWER = (
            'forum_answer',
            'Someone answered your question',
        )
        FORUM_COMMENT = (
            'forum_comment',
            'Someone replied to your answer',
        )
        ASSIGNMENT_CREATED = (
            'assignment_created',
            'A new assignment was posted',
        )
        ASSIGNMENT_GRADED = (
            'assignment_graded',
            'Your submission was graded',
        )
        ASSIGNMENT_REVIEWED = (
            'assignment_reviewed',
            'Your submission received a review',
        )

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    type = models.CharField(max_length=32, choices=Type.choices)
    title = models.CharField(max_length=255)
    body = models.CharField(max_length=500, blank=True)
    link = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} -> {self.recipient}'
