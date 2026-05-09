from django.urls import path
from .views import StudentInsightsView

urlpatterns = [
    path('student/', StudentInsightsView.as_view(), name='student-insights'),
]
