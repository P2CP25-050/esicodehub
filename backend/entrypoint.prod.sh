#!/bin/sh

set -e

if [ "$#" -gt 0 ]; then
    exec "$@"
fi

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

exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --threads 4 \
    --timeout 120 \
    --log-level info
