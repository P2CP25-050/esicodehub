from django.db import models
from django.core.exceptions import ValidationError


class EsiStudent(models.Model):
    school_id = models.CharField(max_length=7, primary_key=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    section = models.CharField(
            max_length=4,
            null=True,
            blank=True,
            help_text="A/B... for 1CP-1CS, SIQA/SIQB/SITA... for 2CS and 3CS, null for alumni",
        )
    group = models.IntegerField(null=True, blank=True)

    class StudyYear(models.TextChoices):
        CP1 = '1CP', '1ère année cycle préparatoire'
        CP2 = '2CP', '2ème année cycle préparatoire'
        CS1 = '1CS', '1ère année cycle supérieur'
        CS2 = '2CS', '2ème année cycle supérieur'
        CS3 = '3CS', '3ème année cycle supérieur'

    study_year = models.CharField(
            max_length=3,
            choices=StudyYear.choices,
            null=True,
            blank=True,
        )

    class Status(models.TextChoices):
        INSCRIT = 'inscrit', 'Inscrit'
        ABANDON = 'abandon', 'Abandon'
        ALUMNI = 'alumni', 'Alumni'

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.INSCRIT)

    def clean(self):
        if self.status == self.Status.ALUMNI:
            if self.section or self.group or self.study_year:
                raise ValidationError('Alumni should not have section, group or study year')
        else:
            if not self.section or not self.group or not self.study_year:
                raise ValidationError('Active students must have section, group and study year')

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
        MAB = 'MAB', 'Maître-Assistant B'
        MCA = 'MCA', 'Maître de Conférences A'
        MCB = 'MCB', 'Maître de Conférences B'
        PR = 'PR', 'Professeur'

    grade = models.CharField(max_length=10, choices=Grade.choices)

    class Status(models.TextChoices):
        PERMANENT = 'permanent', 'Permanent'
        ADJUNCT = 'adjunct', 'Adjunct'

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PERMANENT)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.school_id})"

    class Meta:
        db_table = 'esi_professors'
