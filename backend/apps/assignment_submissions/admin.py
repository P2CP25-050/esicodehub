from django.contrib import admin

from .models import (
    Assignment,
    AssignmentSubmission,
    AssignmentSubmissionFile,
    ReviewComment,
    SubmissionReview,
)


admin.site.register(Assignment)
admin.site.register(AssignmentSubmission)
admin.site.register(AssignmentSubmissionFile)
admin.site.register(SubmissionReview)
admin.site.register(ReviewComment)
