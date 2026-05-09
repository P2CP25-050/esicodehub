from datetime import timedelta

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils import timezone


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    is_subject = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'forum_tags'

    def __str__(self):
        return self.name


class Question(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='questions',
    )
    title = models.CharField(max_length=300)
    body = models.TextField()
    code_snippet = models.TextField(blank=True)
    code_language = models.CharField(max_length=50, blank=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name='questions')
    is_closed = models.BooleanField(default=False)
    accepted_answer = models.ForeignKey(
        'Answer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    view_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'forum_questions'
        ordering = ['-created_at']

    @property
    def can_accept_answer(self):
        return timezone.now() >= self.created_at + timedelta(hours=24)


class QuestionView(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='question_views',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='forum_question_views',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'forum_question_views'
        constraints = [
            models.UniqueConstraint(
                fields=['question', 'user'],
                name='unique_question_view_per_user',
            )
        ]


class Answer(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='answers',
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='forum_answers',
    )
    body = models.TextField()
    code_snippet = models.TextField(blank=True)
    code_language = models.CharField(max_length=50, blank=True)
    is_accepted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'forum_answers'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['parent', 'author'],
                condition=models.Q(parent__isnull=False),
                name='unique_reply_per_user_per_answer',
            )
        ]


class Vote(models.Model):
    UPVOTE = 1
    DOWNVOTE = -1
    VOTE_CHOICES = (
        (UPVOTE, 'Upvote'),
        (DOWNVOTE, 'Downvote'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='forum_votes',
    )
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    value = models.SmallIntegerField(choices=VOTE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'forum_votes'
        unique_together = [['user', 'content_type', 'object_id']]
