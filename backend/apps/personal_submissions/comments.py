from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PersonalSubmission, SubmissionComment


# ── Serializer ────────────────────────────────────────────────────────────────

class SubmissionCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionComment
        fields = ['id', 'line_number', 'body', 'author_name', 'created_at']
        read_only_fields = ['id', 'author_name', 'created_at']

    def validate_line_number(self, value):
        if value < 1:
            raise serializers.ValidationError('line_number must be a positive integer.')
        return value

    def validate_body(self, value):
        if not value.strip():
            raise serializers.ValidationError('Comment body cannot be blank.')
        return value.strip()

    def get_author_name(self, obj):
        return f"{obj.author.first_name} {obj.author.last_name}"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_accessible_submission(pk, user):
    """
    Return the submission if the user may access it, else raise 404 / return None.
    Access rule: public submissions OR submissions owned by the requester.
    """
    submission = get_object_or_404(
        PersonalSubmission.objects.select_related('owner'),
        pk=pk,
    )
    is_public = submission.visibility == PersonalSubmission.Visibility.PUBLIC
    is_owner = submission.owner == user

    if not is_public and not is_owner:
        return None, submission   # caller will return 403

    return submission, None


# ── Views ─────────────────────────────────────────────────────────────────────

class SubmissionCommentListCreateView(APIView):
    """
    GET  /api/personal-submissions/{id}/comments/  — list all comments
    POST /api/personal-submissions/{id}/comments/  — add a comment
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        submission, _ = _get_accessible_submission(pk, request.user)
        if submission is None:
            return Response(
                {'detail': 'You do not have permission to view this submission.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        comments = submission.comments.select_related('author').all()
        serializer = SubmissionCommentSerializer(comments, many=True)
        return Response(serializer.data)

    def post(self, request, pk):
        submission, _ = _get_accessible_submission(pk, request.user)
        if submission is None:
            return Response(
                {'detail': 'You do not have permission to comment on this submission.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SubmissionCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(submission=submission, author=request.user)

        return Response(
            SubmissionCommentSerializer(comment).data,
            status=status.HTTP_201_CREATED,
        )


class SubmissionCommentDeleteView(APIView):
    """
    DELETE /api/personal-submissions/{id}/comments/{cid}/  — delete own comment only
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, cid):
        # Verify the user can see the submission at all
        submission, _ = _get_accessible_submission(pk, request.user)
        if submission is None:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        comment = get_object_or_404(SubmissionComment, id=cid, submission=submission)

        if comment.author != request.user:
            return Response(
                {'detail': 'You can only delete your own comments.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
