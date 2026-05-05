#!/bin/sh

set -e

# If a command is provided (e.g. celery service), run it directly.
# This also handles shell form commands like: /bin/sh -c "celery ..."
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

/wait-for-postgres.sh

python manage.py migrate

python manage.py collectstatic --noinput

# Load subjects only if the table is empty
python manage.py shell -c "
from apps.accounts.models import Subject
if not Subject.objects.exists():
    import subprocess
    subprocess.run(['python', 'manage.py', 'loaddata', 'apps/accounts/fixtures/subjects.json'])
    print('Subjects loaded.')
else:
    print('Subjects already exist, skipping.')
"

exec gunicorn config.wsgi:application --bind 0.0.0.0:8000
