"""Serializers for plagiarism reports and matches."""

from rest_framework import serializers

from .models import PlagiarismReport, SimilarityMatch


class SimilarityMatchSerializer(serializers.ModelSerializer):
    """Serialize similarity match details for plagiarism reports.

    ai_moss_flag: True means the student's code structurally matched an
    AI-generated reference solution. This is a signal for manual review,
    not a verdict.
    """

    student_a_name = serializers.SerializerMethodField()
    student_a_email = serializers.SerializerMethodField()
    student_b_name = serializers.SerializerMethodField()
    student_b_email = serializers.SerializerMethodField()
    max_similarity = serializers.SerializerMethodField()

    def get_max_similarity(self, obj):
        return obj.max_similarity

    class Meta:
        model = SimilarityMatch
        fields = [
            'id',
            'language',
            'student_a_name',
            'student_a_email',
            'student_b_name',
            'student_b_email',
            'similarity_a',
            'similarity_b',
            'max_similarity',
            'lines_matched',
            'moss_link',
            'ai_moss_flag',
        ]

    @staticmethod
    def _full_name(user):
        """Return the full name for a user."""
        return f"{user.first_name} {user.last_name}".strip()

    def _get_student_name(self, submission):
        if not submission:
            return 'AI Reference'
        return self._full_name(submission.student)

    @staticmethod
    def _get_student_email(submission):
        if not submission:
            return ''
        return submission.student.email

    def get_student_a_name(self, obj):
        """Return the full name for submission A's student."""
        return self._get_student_name(obj.submission_a)

    def get_student_a_email(self, obj):
        """Return the email for submission A's student."""
        return self._get_student_email(obj.submission_a)

    def get_student_b_name(self, obj):
        """Return the full name for submission B's student."""
        return self._get_student_name(obj.submission_b)

    def get_student_b_email(self, obj):
        """Return the email for submission B's student."""
        return self._get_student_email(obj.submission_b)


class PlagiarismReportSerializer(serializers.ModelSerializer):
    """Serialize a plagiarism report and its matches."""

    triggered_by = serializers.SerializerMethodField()
    match_count = serializers.SerializerMethodField()
    matches = SimilarityMatchSerializer(many=True, read_only=True)

    class Meta:
        model = PlagiarismReport
        fields = [
            'id',
            'status',
            'triggered_by',
            'triggered_at',
            'completed_at',
            'moss_urls',
            'error_message',
            'match_count',
            'matches',
        ]

    def get_triggered_by(self, obj):
        """Return the email of the professor who triggered the report."""
        return obj.triggered_by.email if obj.triggered_by else ''

    def get_match_count(self, obj):
        """Return the number of similarity matches."""
        cache = getattr(obj, '_prefetched_objects_cache', {})
        if 'matches' in cache:
            return len(cache['matches'])
        return obj.matches.count()
