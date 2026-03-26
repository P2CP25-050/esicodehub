from rest_framework import serializers
from .models import PersonalSubmission, PersonalSubmissionFile


class PersonalSubmissionFileSerializer(serializers.ModelSerializer):
    """Used inside detail responses to show files attached to a submission.
    Read-only never used for creating files directly."""
    class Meta:
        model = PersonalSubmissionFile
        fields = ['id', 'file_name', 'file_path', 'file_size', 'created_at']


class PersonalSubmissionListSerializer(serializers.ModelSerializer):
    """Used for listing submissions minimal data only.
    Includes two computed fields: owner_name and file_count."""
    # Combines first and last name of the owner into one string
    owner_name = serializers.SerializerMethodField()

    # Counts how many files are attached to this submission
    file_count = serializers.SerializerMethodField()

    class Meta:
        model = PersonalSubmission
        fields = [
            'id',
            'title',
            'description',
            'language',
            'course_tag',
            'submission_type',
            'visibility',
            'created_at',
            'owner_name',
            'file_count',
        ]

    def get_owner_name(self, obj):
        """Return the full name of the submission owner."""
        return f"{obj.owner.first_name} {obj.owner.last_name}"

    def get_file_count(self, obj):
        """Return the total number of files attached to this submission."""
        return obj.files.count()


class PersonalSubmissionDetailSerializer(serializers.ModelSerializer):
    """Used for single submission view full data including files and owner info.
    Extends the list serializer with nested files, owner object, and updated_at."""
    # Nested list of all files attached to this submission
    files = PersonalSubmissionFileSerializer(many=True, read_only=True)

    # Nested owner object with basic user info
    owner = serializers.SerializerMethodField()

    class Meta:
        model = PersonalSubmission
        fields = [
            'id',
            'title',
            'description',
            'language',
            'course_tag',
            'submission_type',
            'visibility',
            'created_at',
            'updated_at',
            'owner',
            'files',
        ]

    def get_owner(self, obj):
        """Return basic info about the submission owner."""
        return {
            'email': obj.owner.email,
            'first_name': obj.owner.first_name,
            'last_name': obj.owner.last_name,
            'role': obj.owner.role,
        }


class PersonalSubmissionCreateSerializer(serializers.ModelSerializer):
    """Used for creating and updating submissions.
    Validates that title is not blank and normalizes language to lowercase."""
    class Meta:
        model = PersonalSubmission
        fields = [
            'title',
            'description',
            'language',
            'course_tag',
            'submission_type',
            'visibility',
        ]

    def validate_title(self, value):
        """Reject titles that are empty or contain only whitespace."""
        if not value.strip():
            raise serializers.ValidationError('Title cannot be blank.')
        return value

    def validate_language(self, value):
        """Normalize language to lowercase and remove surrounding whitespace."""
        return value.strip().lower()
