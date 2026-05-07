from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_verification_email(self, user_email: str, code: str):
    """Send email verification code. Retries up to 3 times on SMTP failure."""
    try:
        send_mail(
            subject='Your ESIcodeHub verification code',
            message=(
                f'Your verification code is: {code}\n\n'
                'This code expires in 15 minutes.\n\n'
                'If you did not request this, ignore this email.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user_email],
            fail_silently=False,
        )
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_password_reset_email(self, user_email: str, reset_url: str):
    """Send password reset link."""
    try:
        send_mail(
            subject='Reset your ESIcodeHub password',
            message=(
                'Click the link below to reset your password:\n\n'
                f'{reset_url}\n\n'
                'This link expires in 1 hour.\n\n'
                'If you did not request this, ignore this email.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user_email],
            fail_silently=False,
        )
    except Exception as exc:
        raise self.retry(exc=exc)
