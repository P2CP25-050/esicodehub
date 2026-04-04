from django.utils import timezone
from rest_framework import serializers

from .models import (
    Assignment,
    AssignmentSubmission,
    AssignmentSubmissionFile,
    SubmissionReview,
    ReviewComment,
)


class ReviewCommentSerializer(serializers.ModelSerializer):
    """
    Serializer for line by line review comments.
    Used nested inside SubmissionReviewSerializer.
    """
    # Return only the file id, not the full object
    file = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ReviewComment
        fields = ['id', 'file', 'line_number', 'content', 'created_at']


class AssignmentSubmissionFileSerializer(serializers.ModelSerializer):
    """
    Serializer for files attached to an assignment submission.
    Used nested inside AssignmentSubmissionDetailSerializer.
    """
    class Meta:
        model = AssignmentSubmissionFile
        fields = ['id', 'file_name', 'file_path', 'file_size', 'created_at']


class AssignmentListSerializer(serializers.ModelSerializer):
    """
    Used for listing assignments with minimal data.
    Includes computed fields: is_open, professor_name, and submission_count.
    """
    # Nested subject object with id, name, code
    subject = serializers.SerializerMethodField()

    # True if assignment is currently open for submission
    is_open = serializers.SerializerMethodField()

    # True when the current student has already submitted for this assignment
    has_submitted = serializers.SerializerMethodField()

    # Full name of the professor who created the assignment
    professor_name = serializers.SerializerMethodField()

    # Total number of submissions for this assignment
    submission_count = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            'id',
            'title',
            'description',
            'subject',
            'target_year',
            'target_sections',
            'target_groups',
            'deadline',
            'allow_late',
            'is_open',
            'has_submitted',
            'professor_name',
            'submission_count',
        ]

    def get_subject(self, obj):
        """Return nested subject with id, name and code."""
        return {
            'id': obj.subject.id,
            'name': obj.subject.name,
            'code': obj.subject.code,
        }

    def get_is_open(self, obj):
        """Return whether the assignment is currently open for submission."""
        return obj.is_open_for_submission()

    def get_has_submitted(self, obj):
        """Return True when the authenticated student has a submission."""
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        if not user or user.role != 'student':
            return False

        return obj.submissions.filter(student=user).exists()

    def get_professor_name(self, obj):
        """Return the full name of the professor."""
        return f"{obj.professor.first_name} {obj.professor.last_name}"

    def get_submission_count(self, obj):
        """Return the total number of submissions for this assignment."""
        # Use annotation if available, fall back to query
        if hasattr(obj, 'submission_count'):
            return obj.submission_count
        return obj.submissions.count()


class AssignmentDetailSerializer(AssignmentListSerializer):
    """
    Used for single assignment view with full data.
    Extends list serializer with created_at, updated_at,
    and full professor details.
    """

    # Full professor info as a nested object
    professor = serializers.SerializerMethodField()

    class Meta(AssignmentListSerializer.Meta):
        fields = AssignmentListSerializer.Meta.fields + [
            'professor',
            'created_at',
            'updated_at',
        ]

    def get_professor(self, obj):
        """Return full professor details."""
        return {
            'email': obj.professor.email,
            'first_name': obj.professor.first_name,
            'last_name': obj.professor.last_name,
        }


class AssignmentCreateSerializer(serializers.ModelSerializer):
    """
    Used for creating and updating assignments.
    Validates that deadline is in the future on creation.
    Validates that target_sections and target_groups are mutually exclusive.
    """
    class Meta:
        model = Assignment
        fields = [
            'title',
            'description',
            'subject',
            'target_year',
            'target_sections',
            'target_groups',
            'deadline',
            'allow_late',
        ]

    def validate_deadline(self, value):
        """Reject deadlines that are in the past on creation."""
        # Only validate on creation, not on update
        if self.instance is None and value <= timezone.now():
            raise serializers.ValidationError(
                'Deadline must be in the future.'
            )
        return value

    def validate(self, attrs):
        """Ensure target_sections and target_groups are mutually exclusive."""
        target_sections = attrs.get('target_sections')
        target_groups = attrs.get('target_groups')

        # Both fields are considered non-empty when they are truthy (non-empty list/string)
        sections_set = bool(target_sections)
        groups_set = bool(target_groups)

        if sections_set and groups_set:
            raise serializers.ValidationError(
                'target_sections and target_groups are mutually exclusive. '
                'Provide only one of them.'
            )

        return attrs


class AssignmentSubmissionListSerializer(serializers.ModelSerializer):
    """
    Used for listing all submissions for an assignment (professor view).
    Includes computed fields: student_name, file_count, has_reviews.
    """
    # Full name of the student
    student_name = serializers.SerializerMethodField()

    # Email of the student
    student_email = serializers.SerializerMethodField()

    # Total number of files in this submission
    file_count = serializers.SerializerMethodField()

    # True if at least one review exists for this submission
    has_reviews = serializers.SerializerMethodField()

    class Meta:
        model = AssignmentSubmission
        fields = [
            'id',
            'student_name',
            'student_email',
            'submitted_at',
            'is_late',
            'file_count',
            'has_reviews',
        ]

    def get_student_name(self, obj):
        """Return the full name of the student."""
        return f"{obj.student.first_name} {obj.student.last_name}"

    def get_student_email(self, obj):
        """Return the email of the student."""
        return obj.student.email

    def get_file_count(self, obj):
        """Return the total number of files in this submission."""
        # Use annotation if available, fall back to query
        if hasattr(obj, 'file_count'):
            return obj.file_count
        return obj.files.count()

    def get_has_reviews(self, obj):
        """Return True if at least one review exists for this submission."""
        return obj.reviews.exists()


class SubmissionReviewSerializer(serializers.ModelSerializer):
    """
    Used for viewing a review with all its line comments.
    Includes computed professor_name and nested comments.
    """
    # Full name of the professor who wrote the review
    professor_name = serializers.SerializerMethodField()

    # Nested list of all line comments
    comments = ReviewCommentSerializer(many=True, read_only=True)

    class Meta:
        model = SubmissionReview
        fields = [
            'id',
            'professor_name',
            'general_comment',
            'grade',
            'created_at',
            'updated_at',
            'comments',
        ]

    def get_professor_name(self, obj):
        """Return the full name of the professor."""
        return f"{obj.professor.first_name} {obj.professor.last_name}"


class AssignmentSubmissionDetailSerializer(AssignmentSubmissionListSerializer):
    """
    Used for viewing a single submission in full.
    Extends list serializer with nested files and all reviews.
    """
    # Nested list of all files in this submission
    files = AssignmentSubmissionFileSerializer(many=True, read_only=True)

    # Nested list of all reviews from all professors
    reviews = SubmissionReviewSerializer(many=True, read_only=True)

    class Meta(AssignmentSubmissionListSerializer.Meta):
        fields = AssignmentSubmissionListSerializer.Meta.fields + [
            'files',
            'reviews',
        ]


class ReviewCommentCreateSerializer(serializers.Serializer):
    """
    Used for a single comment inside ReviewCreateSerializer.
    Validates each line comment when creating a review.
    """
    file_id = serializers.IntegerField()
    line_number = serializers.IntegerField(min_value=1)
    # trim_whitespace prevents saving comments with just white spaces
    content = serializers.CharField(trim_whitespace=True)


class ReviewCreateSerializer(serializers.Serializer):
    """
    Used for creating or updating a review.
    Accepts general_comment, grade, and a list of line comments.
    """
    general_comment = serializers.CharField(allow_blank=True, default='')
    grade = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
        max_value=20,
    )
    comments = ReviewCommentCreateSerializer(many=True, default=list)
