from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):

    class Role(models.TextChoices):
        STUDENT   = 'student',   'Student'
        PROFESSOR = 'professor', 'Professor'

    username    = None
    email       = models.EmailField(unique=True)
    first_name  = models.CharField(max_length=150)
    last_name   = models.CharField(max_length=150)
    role        = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    school_id   = models.CharField(max_length=20)
    is_verified = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"


class Student(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')

    def __str__(self):
        return f"Student: {self.user.email}"


class Professor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='professor_profile')

    def __str__(self):
        return f"Professor: {self.user.email}"