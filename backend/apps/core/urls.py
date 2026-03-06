from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health_check'),
    path('test/', views.send_test_data, name='send_test_data'),
]
