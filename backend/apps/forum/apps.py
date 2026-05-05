from django.apps import AppConfig


class ForumConfig(AppConfig):
    name = 'apps.forum'

    def ready(self):
        from . import signals  # noqa: F401
