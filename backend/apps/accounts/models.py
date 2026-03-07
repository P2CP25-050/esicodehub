from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractBaseUser):

    class Role(models.TextChoices):
        STUDENT = 'student', 'Student'
        TEACHER = 'teacher', 'Teacher'

    class Status(models.TextChoices):
        ACTIVE   = 'active',   'Active'
        INACTIVE = 'inactive', 'Inactive'
        BANNED   = 'banned',   'Banned'

    first_name = models.CharField(max_length=150)
    last_name  = models.CharField(max_length=150)
    email      = models.EmailField(unique=True)
    role       = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    status     = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active  = models.BooleanField(default=True)

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"


class Student(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')

    def __str__(self):
        return f"Student: {self.user.email}"


class Teacher(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='teacher_profile')

    def __str__(self):
        return f"Teacher: {self.user.email}"