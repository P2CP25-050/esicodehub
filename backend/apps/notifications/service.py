from .models import Notification


def notify(recipient, type, title, body='', link=''):
    return Notification.objects.create(
        recipient=recipient,
        type=type,
        title=title,
        body=body,
        link=link,
    )
