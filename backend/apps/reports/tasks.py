from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings


@shared_task
def notify_admin_user_report(report_id: int):
    from .models import UserReport
    try:
        report = UserReport.objects.select_related(
            'reporter', 'reported_user'
        ).get(id=report_id)
    except UserReport.DoesNotExist:
        return

    admin_url = (
        f"{settings.BACKEND_URL}/admin/reports/userreport/{report_id}/change/"
    )

    send_mail(
        subject=f"[ESIcodeHub] New user report — {report.reason}",
        message=(
            f"A new user report has been submitted.\n\n"
            f"Reporter:      {report.reporter.email}\n"
            f"Reported user: {report.reported_user.email}\n"
            f"Reason:        {report.get_reason_display()}\n"
            f"Description:   {report.description or '(none)'}\n\n"
            f"Review it here:\n{admin_url}"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[settings.ADMIN_EMAIL],
        fail_silently=False,
    )


@shared_task
def notify_admin_problem_report(report_id: int):
    from .models import ProblemReport
    try:
        report = ProblemReport.objects.select_related('reporter').get(
            id=report_id
        )
    except ProblemReport.DoesNotExist:
        return

    admin_url = (
        f"{settings.BACKEND_URL}/admin/reports/problemreport/{report_id}/change/"
    )

    send_mail(
        subject=f"[ESIcodeHub] Problem report — {report.category}: {report.title}",
        message=(
            f"A new problem report has been submitted.\n\n"
            f"Reporter:    {report.reporter.email}\n"
            f"Category:    {report.get_category_display()}\n"
            f"Title:       {report.title}\n"
            f"Page:        {report.page_url or '(not specified)'}\n\n"
            f"Description:\n{report.description}\n\n"
            f"Review it here:\n{admin_url}"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[settings.ADMIN_EMAIL],
        fail_silently=False,
    )
