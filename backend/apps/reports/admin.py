from django.contrib import admin
from django.utils.html import format_html
from .models import UserReport, ProblemReport, ReportStatus


class StatusFilter(admin.SimpleListFilter):
    title = 'status'
    parameter_name = 'status'

    def lookups(self, request, model_admin):
        return ReportStatus.choices

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(status=self.value())
        # Default to open reports so the first thing you see is what needs attention
        return queryset.filter(status=ReportStatus.OPEN)


@admin.register(UserReport)
class UserReportAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'reporter_email', 'reported_user_email',
        'reason', 'status_badge', 'created_at'
    ]
    list_filter = [StatusFilter, 'reason', 'created_at']
    search_fields = [
        'reporter__email', 'reported_user__email', 'description'
    ]
    readonly_fields = ['reporter', 'reported_user', 'reason', 'description', 'created_at']
    fields = [
        'reporter', 'reported_user', 'reason',
        'description', 'status', 'admin_note', 'created_at'
    ]
    ordering = ['-created_at']

    def reporter_email(self, obj):
        return obj.reporter.email
    reporter_email.short_description = 'Reporter'

    def reported_user_email(self, obj):
        return obj.reported_user.email
    reported_user_email.short_description = 'Reported User'

    def status_badge(self, obj):
        colors = {
            'open': '#e53e3e',
            'reviewed': '#d69e2e',
            'resolved': '#38a169',
            'dismissed': '#718096',
        }
        color = colors.get(obj.status, '#718096')
        return format_html(
            '<span style="'
            'background:{};color:#fff;padding:2px 8px;'
            'border-radius:4px;font-size:11px;font-weight:600">'
            '{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(ProblemReport)
class ProblemReportAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'reporter_email', 'category',
        'title', 'page_url', 'status_badge', 'created_at'
    ]
    list_filter = [StatusFilter, 'category', 'created_at']
    search_fields = ['reporter__email', 'title', 'description', 'page_url']
    readonly_fields = [
        'reporter', 'category', 'title',
        'description', 'page_url', 'created_at'
    ]
    fields = [
        'reporter', 'category', 'title', 'description',
        'page_url', 'status', 'admin_note', 'created_at'
    ]
    ordering = ['-created_at']

    def reporter_email(self, obj):
        return obj.reporter.email
    reporter_email.short_description = 'Reporter'

    def status_badge(self, obj):
        colors = {
            'open': '#e53e3e',
            'reviewed': '#d69e2e',
            'resolved': '#38a169',
            'dismissed': '#718096',
        }
        color = colors.get(obj.status, '#718096')
        return format_html(
            '<span style="'
            'background:{};color:#fff;padding:2px 8px;'
            'border-radius:4px;font-size:11px;font-weight:600">'
            '{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'
