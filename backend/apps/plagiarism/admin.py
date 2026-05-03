from django.contrib import admin
from .models import AIReferenceSubmission, PlagiarismReport, SimilarityMatch


@admin.register(PlagiarismReport)
class PlagiarismReportAdmin(admin.ModelAdmin):
    list_display = ['assignment', 'status', 'triggered_by', 'triggered_at', 'completed_at']
    list_filter = ['status']
    search_fields = ['assignment__title']


@admin.register(SimilarityMatch)
class SimilarityMatchAdmin(admin.ModelAdmin):
    list_display = ['report', 'language', 'similarity_a', 'similarity_b', 'lines_matched']
    list_filter = ['language']


@admin.register(AIReferenceSubmission)
class AIReferenceSubmissionAdmin(admin.ModelAdmin):
    list_display = ['assignment', 'language', 'style', 'file_name', 'generated_at']
    list_filter = ['language', 'style']
    search_fields = ['assignment__title']
