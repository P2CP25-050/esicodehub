from django.urls import path

from .views import PersonalSubmissionDetailView, PersonalSubmissionListCreateView


urlpatterns = [
    path('', PersonalSubmissionListCreateView.as_view(), name='submission-list-create'),
    path(
        '<int:pk>/',
        PersonalSubmissionDetailView.as_view(),
        name='submission-detail',
    ),
]