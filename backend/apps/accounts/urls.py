from django.urls import path
from apps.accounts import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('verify-email/', views.verify_email, name='verify-email'),
    path('resend-verification/', views.resend_verification, name='resend-verification'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('me/', views.me, name='me'),
    path('profile/', views.profile, name='profile'),
    path('token/refresh/', views.token_refresh, name='token-refresh'),
]
