from django.urls import path
from accounts import views
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('register/', views.register, name='register'),
    path('verify-email/', views.verify_email, name='verify-email'),
    path('resend-verification/', views.resend_verification, name='resend-verification'),
    path('login/', views.login, name='login'),
    path('me/', views.me, name='me'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
]
