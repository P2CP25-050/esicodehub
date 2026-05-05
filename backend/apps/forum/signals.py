from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.notifications.models import Notification
from apps.notifications.service import notify
from .models import Answer


@receiver(post_save, sender=Answer)
def notify_on_answer(sender, instance, created, **kwargs):
    if not created:
        return

    if instance.parent is None:
        if instance.author == instance.question.author:
            return

        notify(
            recipient=instance.question.author,
            type=Notification.Type.FORUM_ANSWER,
            title=f'{instance.author.first_name} answered your question',
            body=instance.question.title[:100],
            link=f'/forum/{instance.question.id}',
        )
        return

    if instance.author == instance.parent.author:
        return

    notify(
        recipient=instance.parent.author,
        type=Notification.Type.FORUM_COMMENT,
        title=f'{instance.author.first_name} replied to your answer',
        body=instance.question.title[:100],
        link=f'/forum/{instance.question.id}',
    )
