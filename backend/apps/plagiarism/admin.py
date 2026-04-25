from django.contrib import admin

from .models import PlagiarismReport, SimilarityMatch


admin.site.register(PlagiarismReport)
admin.site.register(SimilarityMatch)
