from .base import *
import os


DEBUG = False


ALLOWED_HOSTS = [
    'api.esicodehub.tech',
    '*.run.app',
]


DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'esicodehub',
        'USER': 'esicodehub_user',
        'PASSWORD': os.getenv('POSTGRES_PASSWORD'),
        'HOST': '/cloudsql/esicodehub:europe-west1:esicodehub-db',
        'PORT': '5432',
    }
}


CORS_ALLOWED_ORIGINS = [
    'https://esicodehub.tech',
    'https://www.esicodehub.tech',
]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [
    'https://esicodehub.tech',
    'https://www.esicodehub.tech',
]


AUTH_COOKIE_SECURE = True
AUTH_COOKIE_SAMESITE = 'None'
SESSION_COOKIE_SECURE = True


EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_APP_PASSWORD')
DEFAULT_FROM_EMAIL = f'ESIcodeHub <{os.getenv("EMAIL_HOST_USER")}>'


GS_BUCKET_NAME = os.getenv('GCS_BUCKET_NAME')
GCS_CREDENTIALS_PATH = None
GS_CREDENTIALS = None


CELERY_BROKER_URL = os.getenv('REDIS_URL')
CELERY_BROKER_USE_SSL = True
CELERY_REDIS_BACKEND_USE_SSL = True


SECURE_SSL_REDIRECT = False  # Cloud Run handles HTTPS termination
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')


GOOGLE_CLOUD_PROJECT = os.getenv('GOOGLE_CLOUD_PROJECT')


FRONTEND_URL = os.getenv('FRONTEND_URL', 'https://esicodehub.tech')
