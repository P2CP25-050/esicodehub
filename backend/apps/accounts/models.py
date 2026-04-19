import secrets
from datetime import timedelta
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


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
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_verified', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = 'student', 'Student'
        PROFESSOR = 'professor', 'Professor'

    username = None
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    school_id = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"


class EmailVerification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_verifications',
    )
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=15)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    def is_valid(self):
        if self.is_used:
            return False, 'Verification code has already been used'
        if self.is_expired:
            return False, 'Verification code has expired'
        return True, 'Valid'

    @staticmethod
    def generate_code():
        return str(secrets.randbelow(900000) + 100000)

    def __str__(self):
        valid, _ = self.is_valid()
        return f"Code for {self.user.email} (valid: {valid})"


class Subject(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return f"{self.code} - {self.name}"

    class Meta:
        ordering = ['code']


class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    avatar = models.ImageField(
        upload_to='avatars/',
        null=True,
        blank=True,
    )
    avatar_data = models.TextField(blank=True, default='')
    avatar_content_type = models.CharField(max_length=100, blank=True, default='')
    bio = models.TextField(blank=True)
    subjects = models.ManyToManyField(
        Subject,
        blank=True,
        related_name='professors',
    )

    def __str__(self):
        return f"Profile of {self.user}"

    class Meta:
        verbose_name = 'Profile'
        verbose_name_plural = 'Profiles'


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
