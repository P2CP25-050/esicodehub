"""Serializers for plagiarism reports and matches."""

from rest_framework import serializers

from .models import PlagiarismReport, SimilarityMatch


class SimilarityMatchSerializer(serializers.ModelSerializer):
    """Serialize similarity match details for plagiarism reports."""

    student_a_name = serializers.SerializerMethodField()
    student_a_email = serializers.SerializerMethodField()
    student_b_name = serializers.SerializerMethodField()
    student_b_email = serializers.SerializerMethodField()
    max_similarity = serializers.IntegerField(read_only=True)

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
        ]

    @staticmethod
    def _full_name(user):
        """Return the full name for a user."""
        return f"{user.first_name} {user.last_name}".strip()

    def get_student_a_name(self, obj):
        """Return the full name for submission A's student."""
        return self._full_name(obj.submission_a.student)

    def get_student_a_email(self, obj):
        """Return the email for submission A's student."""
        return obj.submission_a.student.email

    def get_student_b_name(self, obj):
        """Return the full name for submission B's student."""
        return self._full_name(obj.submission_b.student)

    def get_student_b_email(self, obj):
        """Return the email for submission B's student."""
        return obj.submission_b.student.email


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
