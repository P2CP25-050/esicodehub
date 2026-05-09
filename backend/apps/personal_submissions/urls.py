from django.urls import path

from .views import (
    PersonalSubmissionDetailView,
    PersonalSubmissionListCreateView,
    FileUploadView,
    FileDeleteView,
    FileContentView,
)

from .comments import SubmissionCommentListCreateView, SubmissionCommentDeleteView

urlpatterns = [
    # Submission CRUD routes
    path('', PersonalSubmissionListCreateView.as_view(), name='submission-list-create'),
    path(
        '<int:pk>/',
        PersonalSubmissionDetailView.as_view(),
        name='submission-detail',
    ),
    # File operation routes
    path('<int:pk>/files/', FileUploadView.as_view(), name='upload-files'),
    path('<int:pk>/files/<int:file_id>/', FileDeleteView.as_view(), name='delete-file'),
    path('<int:pk>/files/<int:file_id>/content/', FileContentView.as_view(), name='file-content'),
    # Comment routes
    path(
        '<int:pk>/comments/',
        SubmissionCommentListCreateView.as_view(),
        name='submission-comments',
    ),
    path(
        '<int:pk>/comments/<int:cid>/',
        SubmissionCommentDeleteView.as_view(),
        name='submission-comment-delete',
    ),
]
