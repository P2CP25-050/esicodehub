from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Count, F, Sum
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Answer, Question, Vote
from .serializers import (
    AnswerCreateSerializer,
    AnswerSerializer,
    QuestionCreateSerializer,
    QuestionDetailSerializer,
    QuestionListSerializer,
)


class ForumPagination(PageNumberPagination):
    """Pagination used for forum listing, 20 per page."""
    page_size = 20


def _is_student(user):
    """Return True if the user is a student."""
    return user.role == 'student'


def _get_vote_score(obj, model):
    """Calculate the current total vote score for a given object."""
    content_type = ContentType.objects.get_for_model(model)
    result = Vote.objects.filter(
        content_type=content_type,
        object_id=obj.id,
    ).aggregate(score=Coalesce(Sum('value'), 0))
    return result['score']


def _annotate_questions(queryset):
    """Annotate queryset with vote_score and answer_count."""
    content_type = ContentType.objects.get_for_model(Question)
    return queryset.annotate(
        vote_score=Coalesce(
            Sum(
                'votes__value',
                filter=F('votes__content_type') == content_type.id,
            ),
            0,
        ),
        answer_count=Count('answers', distinct=True),
    )


# Question endpoints

class QuestionListCreateView(APIView):
    """List questions with filtering and allow students to create questions."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Question.objects.select_related(
            'author',
        ).prefetch_related(
            'answers',
        ).annotate(
            answer_count=Count('answers', distinct=True),
        )

        # Filters
        tag = request.query_params.get('tag')
        search = request.query_params.get('search')
        author = request.query_params.get('author')
        ordering = request.query_params.get('ordering', 'newest')

        if tag:
            # Case insensitive contains match on tags JSONField
            queryset = queryset.filter(tags__icontains=tag.lower())
        if search:
            queryset = queryset.filter(title__icontains=search.strip())
        if author:
            queryset = queryset.filter(author__email__iexact=author.strip())

        # Ordering
        if ordering == 'top':
            queryset = queryset.annotate(
                vote_score=Coalesce(Sum('votes__value'), 0)
            ).order_by('-vote_score')
        elif ordering == 'unanswered':
            queryset = queryset.filter(answer_count=0).order_by('-created_at')
        else:
            # Default is the  newest
            queryset = queryset.order_by('-created_at')

        paginator = ForumPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = QuestionListSerializer(
            page,
            many=True,
            context={'request': request},
        )
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        # Students only
        if not _is_student(request.user):
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = QuestionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question = serializer.save(author=request.user)

        detail_serializer = QuestionDetailSerializer(
            question,
            context={'request': request},
        )
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)


class QuestionDetailView(APIView):
    """Retrieve, update and delete a single question."""

    permission_classes = [IsAuthenticated]

    updatable_fields = {
        'title', 'body', 'code_snippet',
        'code_language', 'tags', 'is_closed',
    }

    def get_object(self, pk):
        return get_object_or_404(
            Question.objects.select_related('author').prefetch_related(
                'answers__author',
                'answers__replies__author',
            ),
            pk=pk,
        )

    def get(self, request, pk):
        # Increment view_count without race condition
        Question.objects.filter(pk=pk).update(
            view_count=F('view_count') + 1
        )
        question = self.get_object(pk)
        serializer = QuestionDetailSerializer(
            question,
            context={'request': request},
        )
        return Response(serializer.data)

    def patch(self, request, pk):
        question = self.get_object(pk)

        # Author only and must be a student
        if not _is_student(request.user) or question.author != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Cannot edit if question has an accepted answer
        if question.accepted_answer_id is not None:
            return Response(
                {'detail': 'Cannot edit a question that has an accepted answer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        disallowed = set(request.data.keys()) - self.updatable_fields
        if disallowed:
            return Response(
                {'detail': f'Fields {disallowed} cannot be updated.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = QuestionCreateSerializer(
            question,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        question.refresh_from_db()

        detail_serializer = QuestionDetailSerializer(
            question,
            context={'request': request},
        )
        return Response(detail_serializer.data)

    def delete(self, request, pk):
        question = self.get_object(pk)

        # Author only and must be a student
        if not _is_student(request.user) or question.author != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Cannot delete if question has an accepted answer
        if question.accepted_answer_id is not None:
            return Response(
                {'detail': 'Cannot delete a question that has an accepted answer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        question.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# Answer endpoints

class AnswerCreateView(APIView):
    """Post a top level answer or a reply to an existing answer."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        # Students only
        if not _is_student(request.user):
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        question = get_object_or_404(Question, pk=pk)

        # Cannot post if question is closed
        if question.is_closed:
            return Response(
                {'detail': 'This question is closed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AnswerCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        parent_id = request.data.get('parent_id')
        parent = None

        if parent_id:
            # Validate parent belongs to the same question
            parent = get_object_or_404(Answer, id=parent_id)
            if parent.question_id != question.id:
                return Response(
                    {'detail': 'Parent answer does not belong to this question.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Enforce unique_together, one reply per user per parent
            if Answer.objects.filter(
                parent=parent,
                author=request.user,
            ).exists():
                return Response(
                    {'detail': 'You have already replied to this answer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        answer = serializer.save(
            question=question,
            author=request.user,
            parent=parent,
        )

        return Response(
            AnswerSerializer(answer, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class AnswerDetailView(APIView):
    """Update and delete a single answer."""

    permission_classes = [IsAuthenticated]

    updatable_fields = {'body', 'code_snippet', 'code_language'}

    def get_object(self, qid, aid):
        question = get_object_or_404(Question, pk=qid)
        answer = get_object_or_404(Answer, pk=aid, question=question)
        return question, answer

    def patch(self, request, qid, aid):
        question, answer = self.get_object(qid, aid)

        # Answer author only and must be a student
        if not _is_student(request.user) or answer.author != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        disallowed = set(request.data.keys()) - self.updatable_fields
        if disallowed:
            return Response(
                {'detail': f'Fields {disallowed} cannot be updated.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AnswerCreateSerializer(
            answer,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        answer.refresh_from_db()

        return Response(
            AnswerSerializer(answer, context={'request': request}).data,
        )

    def delete(self, request, qid, aid):
        question, answer = self.get_object(qid, aid)

        # Answer author only and must be a student
        if not _is_student(request.user) or answer.author != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Cannot delete the accepted answer
        if question.accepted_answer_id == answer.id:
            return Response(
                {'detail': 'Cannot delete the accepted answer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        answer.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AnswerAcceptView(APIView):
    """Accept an answer question author only, 24h rule applies."""

    permission_classes = [IsAuthenticated]

    def post(self, request, qid, aid):
        question = get_object_or_404(
            Question.objects.select_related('author'),
            pk=qid,
        )

        # Question author only and must be a student
        if not _is_student(request.user) or question.author != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check 24h rule
        if not question.can_accept_answer:
            return Response(
                {'detail': 'You can only accept an answer 24 hours after posting the question.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check question doesn't already have an accepted answer
        if question.accepted_answer_id is not None:
            return Response(
                {'detail': 'This question already has an accepted answer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        answer = get_object_or_404(Answer, pk=aid, question=question)

        # Only top level answers can be accepted
        if answer.parent_id is not None:
            return Response(
                {'detail': 'Only top-level answers can be accepted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            answer.is_accepted = True
            answer.save(update_fields=['is_accepted'])

            question.accepted_answer = answer
            question.save(update_fields=['accepted_answer'])

        return Response(
            AnswerSerializer(answer, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )


# Vote endpoints

class QuestionVoteView(APIView):
    """Vote on a question ,students only, cannot vote on own content."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        # Students only
        if not _is_student(request.user):
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        question = get_object_or_404(Question, pk=pk)

        # Cannot vote on own content
        if question.author == request.user:
            return Response(
                {'detail': 'You cannot vote on your own content.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        value = request.data.get('value')
        if value not in [1, -1]:
            return Response(
                {'detail': 'Vote value must be 1 or -1.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = ContentType.objects.get_for_model(Question)
        existing_vote = Vote.objects.filter(
            user=request.user,
            content_type=content_type,
            object_id=question.id,
        ).first()

        if existing_vote:
            if existing_vote.value == value:
                # Same vote, toggle off
                existing_vote.delete()
            else:
                # Opposite vote, update it
                existing_vote.value = value
                existing_vote.save(update_fields=['value'])
        else:
            # No vote , create it
            Vote.objects.create(
                user=request.user,
                content_type=content_type,
                object_id=question.id,
                value=value,
            )

        return Response(
            {'vote_score': _get_vote_score(question, Question)},
            status=status.HTTP_200_OK,
        )


class AnswerVoteView(APIView):
    """Vote on an answer , students only, cannot vote on own content."""

    permission_classes = [IsAuthenticated]

    def post(self, request, qid, aid):
        # Students only
        if not _is_student(request.user):
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        get_object_or_404(Question, pk=qid)
        answer = get_object_or_404(Answer, pk=aid, question_id=qid)

        # Cannot vote on own content
        if answer.author == request.user:
            return Response(
                {'detail': 'You cannot vote on your own content.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        value = request.data.get('value')
        if value not in [1, -1]:
            return Response(
                {'detail': 'Vote value must be 1 or -1.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = ContentType.objects.get_for_model(Answer)
        existing_vote = Vote.objects.filter(
            user=request.user,
            content_type=content_type,
            object_id=answer.id,
        ).first()

        if existing_vote:
            if existing_vote.value == value:
                # Same vote , toggle off
                existing_vote.delete()
            else:
                # Opposite vote , update it
                existing_vote.value = value
                existing_vote.save(update_fields=['value'])
        else:
            # No vote , create it
            Vote.objects.create(
                user=request.user,
                content_type=content_type,
                object_id=answer.id,
                value=value,
            )

        return Response(
            {'vote_score': _get_vote_score(answer, Answer)},
            status=status.HTTP_200_OK,
        )
