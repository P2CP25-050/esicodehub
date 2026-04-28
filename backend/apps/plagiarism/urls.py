"""URL configuration for plagiarism endpoints."""

from django.urls import path

from .views import PlagiarismReportDetailView, PlagiarismReportRunView

urlpatterns = [
    path(
        '<int:pk>/plagiarism-report/run/',
        PlagiarismReportRunView.as_view(),
        name='plagiarism-report-run',
    ),
    path(
        '<int:pk>/plagiarism-report/',
        PlagiarismReportDetailView.as_view(),
        name='plagiarism-report-detail',
    ),
]
