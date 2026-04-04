from django.urls import path
from .views import (
    AssignmentDetailView,
    AssignmentListCreateView,
    ProfessorSubmissionDetailView,
    ProfessorSubmissionListView,
    StudentMySubmissionView,
    StudentSubmitView,
    SubmissionFileContentView,
    SubmissionReviewView,
)

urlpatterns = [
    # Assignment CRUD
    path('', AssignmentListCreateView.as_view(), name='assignment-list-create'),
    path('<int:pk>/', AssignmentDetailView.as_view(), name='assignment-detail'),

    # Student submission endpoints
    path('<int:pk>/submit/', StudentSubmitView.as_view(), name='student-submit'),
    path('<int:pk>/my-submission/', StudentMySubmissionView.as_view(), name='my-submission'),

    # Professor submission endpoints
    path(
        '<int:pk>/submissions/',
        ProfessorSubmissionListView.as_view(), name='submission-list'),
    path(
        '<int:pk>/submissions/<int:submission_id>/',
        ProfessorSubmissionDetailView.as_view(), name='submission-detail'),
    path(
        '<int:pk>/submissions/<int:submission_id>/files/<int:file_id>/content/',
        SubmissionFileContentView.as_view(), name='file-content'),
    path(
        '<int:pk>/submissions/<int:submission_id>/reviews/',
        SubmissionReviewView.as_view(), name='submission-reviews'),
]
