from django.urls import path
from .views import UserReportView, ProblemReportView


urlpatterns = [
    path('users/', UserReportView.as_view(), name='report-user'),
    path('problems/', ProblemReportView.as_view(), name='report-problem'),
]
