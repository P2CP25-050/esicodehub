#!/bin/sh

/wait-for-postgres.sh postgresdb

python manage.py migrate

python manage.py collectstatic --noinput

gunicorn config.wsgi:application --bind 0.0.0.0:8000
