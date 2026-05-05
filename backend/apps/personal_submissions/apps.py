from django.apps import AppConfig


class PersonalSubmissionsConfig(AppConfig):
    name = 'apps.personal_submissions'

    def ready(self):
        from . import checks  # noqa: F401
