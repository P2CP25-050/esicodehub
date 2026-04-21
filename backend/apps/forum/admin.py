from django.contrib import admin

from .models import Answer, Question, Vote


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'title',
        'author',
        'is_closed',
        'view_count',
        'created_at',
    )
    search_fields = ('title', 'body', 'author__email', 'author__username')
    list_filter = ('is_closed', 'created_at')


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'question',
        'parent',
        'author',
        'is_accepted',
        'created_at',
    )
    search_fields = ('body', 'author__email', 'author__username')
    list_filter = ('is_accepted', 'created_at')


@admin.register(Vote)
class VoteAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'content_type',
        'object_id',
        'value',
        'created_at',
    )
    list_filter = ('value', 'content_type', 'created_at')