from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Count, F, IntegerField, OuterRef, Prefetch, Subquery, Sum, Value, Q
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Answer, Question, QuestionView, Vote, Tag
from .serializers import (
    AnswerCreateSerializer,
    AnswerSerializer,
    QuestionCreateSerializer,
    QuestionDetailSerializer,
    QuestionListSerializer,
    TagSerializer,
)


class ForumPagination(PageNumberPagination):
    """Pagination used for forum listing, 20 per page."""

    page_size = 20


def _is_student(user):
    """Return True if the user is a student."""
    return getattr(user, 'role', None) == 'student'


def _vote_score_subquery(model):
    """Build a vote score subquery for generic relations."""
    content_type = ContentType.objects.get_for_model(model)
    return (
        Vote.objects.filter(
            content_type=content_type,
            object_id=OuterRef('pk'),
        )
        .values('object_id')
        .annotate(score=Sum('value'))
        .values('score')[:1]
    )


def _annotate_questions(queryset):
    """Annotate question querysets with vote_score and answer_count."""
    return queryset.annotate(
        vote_score=Coalesce(
            Subquery(_vote_score_subquery(Question), output_field=IntegerField()),
            Value(0),
        ),
        answer_count=Count('answers', distinct=True),
    )


def _annotate_answers(queryset):
    """Annotate answer querysets with vote_score and reply_count."""
    return queryset.annotate(
        vote_score=Coalesce(
            Subquery(_vote_score_subquery(Answer), output_field=IntegerField()),
            Value(0),
        ),
        reply_count=Count('replies', distinct=True),
    )


def _get_vote_score(obj, model):
    """Calculate the current total vote score for a given object."""
    content_type = ContentType.objects.get_for_model(model)
    result = Vote.objects.filter(
        content_type=content_type,
        object_id=obj.id,
    ).aggregate(score=Coalesce(Sum('value'), 0))
    return result['score']


def get_annotated_answers(question, user):
    """
    Return a queryset of top-level answers for the given question, annotated
    with vote_score_db and user_vote_value, both resolved in the database so
    no per answer queries are needed in the serializer.
    Also prefetches replies and their authors to avoid queries in nested
    """
    answer_ct = ContentType.objects.get_for_model(Answer)

    # Subquery: total vote score per answer
    vote_score_subquery = (
        Vote.objects.filter(
            content_type=answer_ct,
            object_id=OuterRef('pk'),
        )
        .values('object_id')
        .annotate(total=Sum('value'))
        .values('total')[:1]
    )

    replies_qs = (
        Answer.objects.select_related('author')
        .annotate(
            vote_score_db=Coalesce(
                Subquery(vote_score_subquery, output_field=IntegerField()),
                Value(0),
            ),
            reply_count=Count('replies', distinct=True),
        )
        .order_by('created_at')
    )

    # Only annotate user_vote_value when there is an authenticated user —
    # avoids a needless subquery for anonymous/unauthenticated contexts.
    if user is not None and user.is_authenticated:
        user_vote_subquery = (
            Vote.objects.filter(
                content_type=answer_ct,
                object_id=OuterRef('pk'),
                user=user,
            )
            .values('value')[:1]
        )
        replies_qs = replies_qs.annotate(
            user_vote_value=Subquery(
                user_vote_subquery, output_field=IntegerField()
            )
        )

    qs = (
        Answer.objects.filter(question=question, parent=None)
        .select_related('author')
        .prefetch_related(
            Prefetch('replies', queryset=replies_qs, to_attr='prefetched_replies')
        )
        .annotate(
            vote_score_db=Coalesce(
                Subquery(vote_score_subquery, output_field=IntegerField()),
                Value(0),
            ),
            reply_count=Count('replies', distinct=True),
        )
        .order_by('created_at')
    )

    return qs


class QuestionListCreateView(APIView):
    """List questions with filtering and allow students to create questions."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = _annotate_questions(
            Question.objects.select_related('author')
        )

        tag = request.query_params.get('tag')
        search = request.query_params.get('search')
        author = request.query_params.get('author')
        ordering = request.query_params.get('ordering', 'newest')

        if tag:
            matching_tags = Tag.objects.filter(name__icontains=tag.strip())
            queryset = queryset.filter(tags__in=matching_tags).distinct()
        if search:
            search_clean = search.strip()
            queryset = queryset.filter(
                Q(title__icontains=search_clean) |
                Q(tags__name__icontains=search_clean)
            ).distinct()
        if author:
            queryset = queryset.filter(author__email__iexact=author.strip())

        if ordering == 'top':
            queryset = queryset.order_by('-vote_score', '-created_at')
        elif ordering == 'unanswered':
            queryset = queryset.filter(answer_count=0).order_by('-created_at')
        else:
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
        if not _is_student(request.user):
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = QuestionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question = serializer.save(author=request.user)

        question = _annotate_questions(
            Question.objects.select_related('author').filter(pk=question.pk)
        ).get()
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
            _annotate_questions(
                Question.objects.select_related('author')
            ),
            pk=pk,
        )

    def get(self, request, pk):
        question = self.get_object(pk)

        if request.user.is_authenticated and request.user != question.author:
            with transaction.atomic():
                _, created = QuestionView.objects.get_or_create(
                    question=question,
                    user=request.user,
                )
                if created:
                    Question.objects.filter(pk=question.pk).update(
                        view_count=F('view_count') + 1
                    )
                    question.refresh_from_db(fields=['view_count'])

        # Build the fully-annotated answer queryset once, no per answer
        # queries will be fired in AnswerSerializer for vote_score or
        # user_vote when this queryset is passed via context.
        annotated_answers = get_annotated_answers(question, request.user)

        serializer = QuestionDetailSerializer(
            question,
            context={
                'request': request,
                'annotated_answers': annotated_answers,
            },
        )
        return Response(serializer.data)

    def patch(self, request, pk):
        question = self.get_object(pk)

        if not _is_student(request.user) or question.author != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

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

        question = _annotate_questions(
            Question.objects.select_related('author').filter(pk=question.pk)
        ).get()
        detail_serializer = QuestionDetailSerializer(
            question,
            context={'request': request},
        )
        return Response(detail_serializer.data)

    def delete(self, request, pk):
        question = self.get_object(pk)

        if not _is_student(request.user) or question.author != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if question.accepted_answer_id is not None:
            return Response(
                {'detail': 'Cannot delete a question that has an accepted answer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        question.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AnswerCreateView(APIView):
    """Post a top level answer or a reply to an existing answer."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not _is_student(request.user):
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        question = get_object_or_404(Question, pk=pk)

        if question.is_closed:
            return Response(
                {'detail': 'This question is closed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AnswerCreateSerializer(
            data=request.data,
            context={'question': question, 'request': request},
        )
        serializer.is_valid(raise_exception=True)

        parent = serializer.validated_data.get('parent')
        if parent is not None and Answer.objects.filter(
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
        )
        answer = _annotate_answers(
            Answer.objects.select_related('author').filter(pk=answer.pk)
        ).get()

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
        answer = get_object_or_404(
            _annotate_answers(
                Answer.objects.select_related('author').prefetch_related(
                    'replies__author',
                )
            ),
            pk=aid,
            question=question,
        )
        return question, answer

    def patch(self, request, qid, aid):
        question, answer = self.get_object(qid, aid)

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
            context={'question': question, 'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        answer = _annotate_answers(
            Answer.objects.select_related('author').filter(pk=answer.pk)
        ).get()
        return Response(
            AnswerSerializer(answer, context={'request': request}).data,
        )

    def delete(self, request, qid, aid):
        question, answer = self.get_object(qid, aid)

        if not _is_student(request.user) or answer.author != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

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

        if not _is_student(request.user) or question.author != request.user:
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not question.can_accept_answer:
            return Response(
                {'detail': 'You can only accept an answer 24 hours after posting the question.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if question.accepted_answer_id is not None:
            return Response(
                {'detail': 'This question already has an accepted answer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        answer = get_object_or_404(Answer, pk=aid, question=question)

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

        answer = _annotate_answers(
            Answer.objects.select_related('author').filter(pk=answer.pk)
        ).get()
        return Response(
            AnswerSerializer(answer, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )


class QuestionVoteView(APIView):
    """Vote on a question, students only, cannot vote on own content."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not _is_student(request.user):
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        question = get_object_or_404(Question, pk=pk)

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
                existing_vote.delete()
            else:
                existing_vote.value = value
                existing_vote.save(update_fields=['value'])
        else:
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
    """Vote on an answer, students only, cannot vote on own content."""

    permission_classes = [IsAuthenticated]

    def post(self, request, qid, aid):
        if not _is_student(request.user):
            return Response(
                {'detail': 'You do not have permission to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        get_object_or_404(Question, pk=qid)
        answer = get_object_or_404(Answer, pk=aid, question_id=qid)

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
                existing_vote.delete()
            else:
                existing_vote.value = value
                existing_vote.save(update_fields=['value'])
        else:
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


class TagListView(APIView):
    """
    GET /api/forum/tags/?q=algo   — search tags, returns top 10 matches.
    No ?q param returns the 10 most recent tags (useful for default autocomplete state).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get('q', '').strip().strip('/')
        qs = Tag.objects.filter(name__icontains=q) if q else Tag.objects.all()
        tags = qs.order_by('name')[:10]
        return Response(TagSerializer(tags, many=True).data)


class SubjectTagListView(APIView):
    """
    GET /api/forum/tags/subjects/  — all subject tags for the autocomplete picker.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tags = Tag.objects.filter(is_subject=True).order_by('name')
        return Response(TagSerializer(tags, many=True).data)
