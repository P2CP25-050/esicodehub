from django.urls import path
from . import views

urlpatterns = [
    # Question endpoints
    path(
        'questions/',
        views.QuestionListCreateView.as_view(),
        name='question-list-create',
    ),
    path(
        'questions/<int:pk>/',
        views.QuestionDetailView.as_view(),
        name='question-detail',
    ),

    # Answer endpoints
    path(
        'questions/<int:pk>/answers/',
        views.AnswerCreateView.as_view(),
        name='answer-create',
    ),
    path(
        'questions/<int:qid>/answers/<int:aid>/',
        views.AnswerDetailView.as_view(),
        name='answer-detail',
    ),
    path(
        'questions/<int:qid>/answers/<int:aid>/accept/',
        views.AnswerAcceptView.as_view(),
        name='answer-accept',
    ),

    # Vote endpoints
    path(
        'questions/<int:pk>/vote/',
        views.QuestionVoteView.as_view(),
        name='question-vote',
    ),
    path(
        'questions/<int:qid>/answers/<int:aid>/vote/',
        views.AnswerVoteView.as_view(),
        name='answer-vote',
    ),
    # Tag endpoints
    path('tags/', views.TagListView.as_view()),
    path('tags/subjects/', views.SubjectTagListView.as_view()),
]
