from django.urls import path
from apps.accounts import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('register/verify-email/', views.verify_email, name='verify-email'),
    path('register/resend-verification/', views.resend_verification, name='resend-verification'),
]
