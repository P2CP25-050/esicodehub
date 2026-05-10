#!/bin/sh

set -e

if [ "$#" -gt 0 ]; then
    exec "$@"
fi

if [ -z "$K_SERVICE" ] || [ "$RUN_MIGRATIONS" = "1" ]; then
    python manage.py migrate

    python manage.py collectstatic --noinput

    python manage.py shell -c "
from apps.accounts.models import Subject
if not Subject.objects.exists():
    import subprocess
    subprocess.run(['python', 'manage.py', 'loaddata', 'apps/accounts/fixtures/subjects.json'])
    print('Subjects loaded.')
else:
    print('Subjects already exist, skipping.')
"
fi

exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:${PORT:-8080} \
    --workers 2 \
    --threads 4 \
    --timeout 120 \
    --log-level info \
    --access-logfile - \
    --error-logfile - \
    --capture-output
