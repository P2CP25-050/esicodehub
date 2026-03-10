from django.db import models
from django.core.exceptions import ValidationError


class EsiStudent(models.Model):
    school_id = models.CharField(max_length=7, primary_key=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    section = models.CharField(max_length=4) # Same as the specialty for 2CS and 3CS
    group = models.IntegerField()

    class StudyYear(models.TextChoices):
        CP1 = '1CP', '1ère année cycle préparatoire'
        CP2 = '2CP', '2ème année cycle préparatoire'
        CS1 = '1CS', '1ère année cycle supérieur'
        CS2 = '2CS', '2ème année cycle supérieur'
        CS3 = '3CS', '3ème année cycle supérieur'

    study_year = models.CharField(max_length=3, choices=StudyYear.choices)

    class Status(models.TextChoices):
        INSCRIT = 'inscrit', 'Inscrit'
        ABANDON = 'abandon', 'Abandon'
        ALUMNI = 'alumni', 'Alumni'

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.INSCRIT)

    def clean(self):
        specialty_years = ['2CS', '3CS']
        if self.study_year not in specialty_years and self.specialty is not None:
            raise ValidationError('Only 2CS and 3CS students can have a specialty')
        if self.study_year in specialty_years and self.specialty is None:
            raise ValidationError('2CS and 3CS students must have a specialty')

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.school_id})"

    class Meta:
        db_table = 'esi_students'


class EsiProfessor(models.Model):
    school_id = models.CharField(max_length=7, primary_key=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)

    class Grade(models.TextChoices):
        MA = 'MA', 'Maître-Assistant'
        MAA = 'MAA', 'Maître-Assistant A'
        MAB = 'MAB', 'Maître-Assistant B'
        MCA = 'MCA', 'Maître de Conférences A'
        MCB = 'MCB', 'Maître de Conférences B'
        PR = 'PR', 'Professeur'

    grade = models.CharField(max_length=10, choices=Grade.choices)

    class Status(models.TextChoices):
        PERMANENT = 'permanent', 'Permanent'
        ADJUNCT = 'adjunct', 'Adjunct'

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ADJUNCT)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.school_id})"

    class Meta:
        db_table = 'esi_professors'
