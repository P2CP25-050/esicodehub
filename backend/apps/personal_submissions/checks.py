import os
import sys

from django.conf import settings
from django.core.checks import Error, Warning, register

from .gcs import validate_gcs_configuration


@register()
def gcs_configuration_check(app_configs=None, **kwargs):
    if getattr(settings, 'TESTING', False):
        return []

    if os.getenv('SKIP_GCS_CHECKS') == '1':
        return []

    if os.getenv('K_SERVICE'):
        return []

    skip_commands = {
        'migrate',
        'makemigrations',
        'collectstatic',
        'createsuperuser',
        'loaddata',
    }
    if any(command in sys.argv for command in skip_commands):
        return []

    issues = validate_gcs_configuration()
    if not issues:
        return []

    check_class = Error if not settings.DEBUG else Warning
    check_id_prefix = 'personal_submissions.E' if check_class is Error else 'personal_submissions.W'

    return [
        check_class(
            message,
            hint='Check backend/.env values and docker-compose volume mounts for GCS credentials.',
            id=f'{check_id_prefix}{index:03d}',
        )
        for index, message in enumerate(issues, start=1)
    ]
