from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from apps.notifications.models import Notification
from apps.notifications.service import notify
from .models import Assignment, SubmissionReview


@receiver(post_save, sender=Assignment)
def notify_on_assignment_created(sender, instance, created, **kwargs):
    if not created:
        return

    due_date = timezone.localtime(instance.deadline).strftime('%b %d')
    targeted_students = instance.get_targeted_students()
    notifications = [
        Notification(
            recipient=student,
            type=Notification.Type.ASSIGNMENT_CREATED,
            title=f'New assignment: {instance.title}',
            body=f'Due {due_date}',
            link=f'/assignments/{instance.id}',
        )
        for student in targeted_students
    ]
    Notification.objects.bulk_create(notifications)


@receiver(post_save, sender=SubmissionReview)
def notify_on_review(sender, instance, created, **kwargs):
    if not created:
        return

    submission = instance.submission
    assignment = submission.assignment
    notify(
        recipient=submission.student,
        type=Notification.Type.ASSIGNMENT_REVIEWED,
        title='Your submission received a review',
        body=assignment.title,
        link=f'/assignments/{assignment.id}/submissions/{submission.id}',
    )
