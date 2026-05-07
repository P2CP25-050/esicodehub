from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import UserReport, ProblemReport


User = get_user_model()


class UserReportSerializer(serializers.Serializer):
    reported_user_email = serializers.EmailField()
    reason = serializers.ChoiceField(choices=UserReport.Reason.choices)
    description = serializers.CharField(
        required=False, allow_blank=True, max_length=1000
    )

    def validate_reported_user_email(self, value):
        request = self.context['request']

        if value == request.user.email:
            raise serializers.ValidationError("You cannot report yourself.")

        try:
            user = User.objects.get(email=value, is_verified=True)
        except User.DoesNotExist:
            raise serializers.ValidationError("No account found with this email.")

        return user

    def validate(self, data):
        reporter = self.context['request'].user
        reported_user = data['reported_user_email']

        if not UserReport.check_rate_limit(reporter):
            raise serializers.ValidationError(
                "You have submitted too many reports in the last 24 hours."
            )

        if UserReport.has_open_duplicate(reporter, reported_user, data['reason']):
            raise serializers.ValidationError(
                "You have already submitted this report. Our team is reviewing it."
            )

        return data

    def create(self, validated_data):
        return UserReport.objects.create(
            reporter=self.context['request'].user,
            reported_user=validated_data['reported_user_email'],
            reason=validated_data['reason'],
            description=validated_data.get('description', ''),
        )


class ProblemReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProblemReport
        fields = ['category', 'title', 'description', 'page_url']

    def create(self, validated_data):
        validated_data['reporter'] = self.context['request'].user
        return super().create(validated_data)
