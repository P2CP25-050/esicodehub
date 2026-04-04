from .base import *

DEBUG = True
TESTING = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Keep tests deterministic and faster.
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]