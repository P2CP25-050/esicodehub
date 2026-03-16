from django.contrib.auth.backends import ModelBackend
from accounts.models import User


class EmailBackend(ModelBackend):
    def authenticate(self, request, email=None, password=None, **kwargs):
        """ Custom authentication backend that allows Django to authenticate
         users using email instead of the default username field"""
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Email not found
            return None

        if user.check_password(password):
            # Password matches
            return user
         # Password is wrong
        return None