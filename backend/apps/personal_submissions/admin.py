from django.contrib import admin

from .models import PersonalSubmission, PersonalSubmissionFile


@admin.register(PersonalSubmission)
class PersonalSubmissionAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'title',
        'owner',
        'language',
        'submission_type',
        'visibility',
        'created_at',
    )
    search_fields = (
        'title',
        'description',
        'language',
        'course_tag',
        'owner__email',
        'owner__username',
    )
    list_filter = ('submission_type', 'visibility', 'language', 'created_at')


@admin.register(PersonalSubmissionFile)
class PersonalSubmissionFileAdmin(admin.ModelAdmin):
    list_display = ('id', 'submission', 'file_name', 'file_path', 'file_size', 'created_at')
    search_fields = ('file_name', 'file_path', 'gcs_path', 'submission__title')
