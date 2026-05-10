from django.urls import path

from apps.accounts import views


urlpatterns = [
    path('search/', views.profile_search, name='profile-search'),
    path('<path:public_id>/', views.profile_public, name='profile-public'),
]
