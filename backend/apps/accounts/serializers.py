import base64

from rest_framework import serializers

from .models import Profile, Subject, User


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
        if obj.avatar_data and obj.avatar_content_type:
            return f'data:{obj.avatar_content_type};base64,{obj.avatar_data}'

        if not obj.avatar:
            return None

        url = obj.avatar.url
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(url)
        return url


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
