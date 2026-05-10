from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.serializers import _build_avatar_value
from apps.notifications.models import Notification

from .models import PersonalSubmission, SubmissionComment


# ── Serializer ────────────────────────────────────────────────────────────────

class SubmissionCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_email = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    author = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionComment
        fields = [
            'id',
            'line_number',
            'body',
            'author_name',
            'author_email',
            'author_avatar',
            'author',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'author_name',
            'author_email',
            'author_avatar',
            'author',
            'created_at',
        ]

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

    def get_author_email(self, obj):
        return obj.author.email

    def get_author_avatar(self, obj):
        request = self.context.get('request')
        profile = getattr(obj.author, 'profile', None)
        return _build_avatar_value(profile, request)

    def get_author(self, obj):
        request = self.context.get('request')
        profile = getattr(obj.author, 'profile', None)
        return {
            'email': obj.author.email,
            'first_name': obj.author.first_name,
            'last_name': obj.author.last_name,
            'role': obj.author.role,
            'avatar': _build_avatar_value(profile, request),
        }


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
    GET  /api/submissions/{id}/comments/  — list all comments
    POST /api/submissions/{id}/comments/  — add a comment
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
        serializer = SubmissionCommentSerializer(comments, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, pk):
        submission, _ = _get_accessible_submission(pk, request.user)
        if submission is None:
            return Response(
                {'detail': 'You do not have permission to comment on this submission.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SubmissionCommentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(submission=submission, author=request.user)

        # Notify submission owner when someone else comments.
        if submission.owner_id != request.user.id:
            commenter_name = f"{request.user.first_name} {request.user.last_name}".strip() or (
                                                request.user.email)
            Notification.objects.create(
                recipient=submission.owner,
                type=Notification.Type.SUBMISSION_COMMENTED,
                title='New comment on your submission',
                body=(
                    f"{commenter_name} commented on line {comment.line_number} "
                    f"of \"{submission.title}\"."
                ),
                link=f'/submissions/{submission.id}',
            )

        return Response(
            SubmissionCommentSerializer(comment, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class SubmissionCommentDeleteView(APIView):
    """
    DELETE /api/submissions/{id}/comments/{cid}/  — delete own comment only
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
