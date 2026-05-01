"""URL configuration for plagiarism endpoints."""

from django.urls import path

from .views import (
    PlagiarismReferenceGenerateView,
    PlagiarismReferenceStatusView,
    PlagiarismReportDetailView,
    PlagiarismReportRunView,
)

urlpatterns = [
    path(
        '<int:pk>/plagiarism-report/run/',
        PlagiarismReportRunView.as_view(),
        name='plagiarism-report-run',
    ),
    path(
        '<int:pk>/plagiarism-report/generate-references/',
        PlagiarismReferenceGenerateView.as_view(),
        name='plagiarism-report-generate-references',
    ),
    path(
        '<int:pk>/plagiarism-report/references-status/',
        PlagiarismReferenceStatusView.as_view(),
        name='plagiarism-report-references-status',
    ),
    path(
        '<int:pk>/plagiarism-report/',
        PlagiarismReportDetailView.as_view(),
        name='plagiarism-report-detail',
    ),
]
