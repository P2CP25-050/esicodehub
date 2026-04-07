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
    class Meta:
        model = Profile
        fields = ['bio', 'avatar']
