from django.contrib import admin
from .models import EsiStudent, EsiProfessor


@admin.register(EsiStudent)
class EsiStudentAdmin(admin.ModelAdmin):
    list_display = ['school_id', 'first_name', 'last_name', 'email',
                    'study_year', 'section', 'group', 'status']
    list_filter = ['study_year', 'status', 'section']
    search_fields = ['first_name', 'last_name', 'email', 'school_id']


@admin.register(EsiProfessor)
class EsiProfessorAdmin(admin.ModelAdmin):
    list_display = ['school_id', 'first_name', 'last_name', 'email', 'grade', 'status']
    list_filter = ['grade', 'status']
    search_fields = ['first_name', 'last_name', 'email', 'school_id']
