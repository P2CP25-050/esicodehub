from django.urls import path
from .views import StudentInsightsView, ProfessorInsightsView

urlpatterns = [
    path('student/', StudentInsightsView.as_view(), name='student-insights'),
    path('professor/', ProfessorInsightsView.as_view(), name='professor-insights'),
]
