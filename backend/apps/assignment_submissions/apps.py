from django.apps import AppConfig


class AssignmentSubmissionsConfig(AppConfig):
    name = 'apps.assignment_submissions'

    def ready(self):
        from . import signals  # noqa: F401
