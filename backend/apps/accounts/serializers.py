import base64

from rest_framework import serializers

from apps.esi_db.models import EsiStudent
from apps.forum.models import Answer, Question
from apps.personal_submissions.models import PersonalSubmission

from .models import Profile, Subject, User


def _build_avatar_value(profile, request=None):
    if profile is None:
        return None

    if profile.avatar_data and profile.avatar_content_type:
        return f'data:{profile.avatar_content_type};base64,{profile.avatar_data}'

    if not profile.avatar:
        return None

    url = profile.avatar.url
    if request:
        return request.build_absolute_uri(url)
    return url


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, value):
        if not value.endswith('@esi.dz'):
            raise serializers.ValidationError('Only @esi.dz emails are allowed.')
        return value.lower()

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})
        return data


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6, min_length=6)

    def validate_email(self, value):
        return value.lower()


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        """convert email to lowercase."""
        return value.lower()


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name', 'code']


class ProfileSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()
    subjects = SubjectSerializer(many=True, read_only=True)

    class Meta:
        model = Profile
        fields = ['avatar', 'bio', 'subjects']

    def get_avatar(self, obj):
        request = self.context.get('request')
        return _build_avatar_value(obj, request)


class UserProfileSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'first_name',
            'last_name',
            'email',
            'role',
            'school_id',
            'created_at',
            'profile',
        ]


class PublicProfileSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalSubmission
        fields = ['id', 'title', 'description', 'language', 'submission_type', 'created_at']


class PublicProfileQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['id', 'title', 'tags', 'created_at']


class PublicProfileAnswerSerializer(serializers.ModelSerializer):
    question = serializers.IntegerField(source='question_id', read_only=True)
    question_title = serializers.CharField(source='question.title', read_only=True)

    class Meta:
        model = Answer
        fields = ['id', 'question', 'question_title', 'body', 'created_at']


class PublicProfileStatsSerializer(serializers.Serializer):
    submissions_count = serializers.IntegerField()
    questions_count = serializers.IntegerField()
    answers_count = serializers.IntegerField()
    accepted_answers_count = serializers.IntegerField()


class PublicProfileSerializer(serializers.ModelSerializer):
    bio = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    joined_at = serializers.DateTimeField(source='created_at', read_only=True)
    stats = serializers.SerializerMethodField()
    recent_activity = serializers.SerializerMethodField()
    study_year = serializers.SerializerMethodField()
    section = serializers.SerializerMethodField()
    group = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'school_id',
            'first_name',
            'last_name',
            'role',
            'bio',
            'avatar',
            'study_year',
            'section',
            'group',
            'joined_at',
            'stats',
            'recent_activity',
        ]

    def _get_student(self, obj):
        student_map = self.context.get('student_map') or {}
        if obj.school_id in student_map:
            return student_map[obj.school_id]

        if obj.role != User.Role.STUDENT or not obj.school_id:
            return None

        return EsiStudent.objects.filter(school_id=obj.school_id).first()

    def get_bio(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.bio if profile else ''

    def get_avatar(self, obj):
        profile = getattr(obj, 'profile', None)
        request = self.context.get('request')
        return _build_avatar_value(profile, request)

    def get_stats(self, obj):
        return PublicProfileStatsSerializer(self.context.get('stats', {})).data

    def get_recent_activity(self, obj):
        if obj.role != User.Role.STUDENT:
            return {}

        activity = self.context.get('recent_activity') or {}
        return {
            'submissions': PublicProfileSubmissionSerializer(
                activity.get('submissions', []),
                many=True,
                context=self.context,
            ).data,
            'questions': PublicProfileQuestionSerializer(
                activity.get('questions', []),
                many=True,
                context=self.context,
            ).data,
            'answers': PublicProfileAnswerSerializer(
                activity.get('answers', []),
                many=True,
                context=self.context,
            ).data,
        }

    def get_study_year(self, obj):
        student = self._get_student(obj)
        return student.study_year if student else None

    def get_section(self, obj):
        student = self._get_student(obj)
        return student.section if student else None

    def get_group(self, obj):
        student = self._get_student(obj)
        return student.group if student else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.role != User.Role.STUDENT:
            data.pop('study_year', None)
            data.pop('section', None)
            data.pop('group', None)
        return data


class ProfileSearchResultSerializer(serializers.Serializer):
    school_id = serializers.CharField()
    name = serializers.SerializerMethodField()
    role = serializers.CharField()
    avatar = serializers.SerializerMethodField()
    study_year = serializers.SerializerMethodField()

    def get_name(self, obj):
        return f'{obj.first_name} {obj.last_name}'.strip()

    def get_avatar(self, obj):
        profile = getattr(obj, 'profile', None)
        request = self.context.get('request')
        return _build_avatar_value(profile, request)

    def get_study_year(self, obj):
        student_map = self.context.get('student_map') or {}
        student = student_map.get(obj.school_id)
        if student is None:
            return None
        return student.study_year


class ProfileUpdateSerializer(serializers.ModelSerializer):
    avatar = serializers.FileField(required=False, allow_null=True, write_only=True)

    ALLOWED_AVATAR_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
    MAX_AVATAR_SIZE = 2 * 1024 * 1024

    class Meta:
        model = Profile
        fields = ['bio', 'avatar']

    def validate_avatar(self, value):
        if value is None:
            return value

        content_type = (getattr(value, 'content_type', '') or '').lower()
        if content_type not in self.ALLOWED_AVATAR_TYPES:
            raise serializers.ValidationError('Only .jpg, .png, and .webp files are allowed.')

        if value.size > self.MAX_AVATAR_SIZE:
            raise serializers.ValidationError('File must be under 2MB.')

        return value

    def update(self, instance, validated_data):
        avatar_file = validated_data.pop('avatar', serializers.empty)

        if avatar_file is not serializers.empty:
            if avatar_file is None:
                instance.avatar_data = ''
                instance.avatar_content_type = ''
            else:
                avatar_file.seek(0)
                encoded_avatar = base64.b64encode(avatar_file.read()).decode('ascii')
                instance.avatar_data = encoded_avatar
                instance.avatar_content_type = (avatar_file.content_type or '').lower()

            if instance.avatar:
                instance.avatar.delete(save=False)
            instance.avatar = None

        return super().update(instance, validated_data)
