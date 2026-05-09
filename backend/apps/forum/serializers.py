from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, IntegerField, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework import serializers
from .models import Answer, Question, Vote, Tag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'is_subject']


class AnswerSerializer(serializers.ModelSerializer):
    """
    Recursive serializer for answers and their replies.
    Serializes nested replies recursively.
    Expects objects annotated with:
      - vote_score_db   (int) : total vote score, set by get_annotated_answers()
      - user_vote_value (int|None) : current user's vote, set by get_annotated_answers()
      - reply_count     (int) : number of direct replies
    Falls back to live queries only when those annotations are absent (e.g.
    when a single answer is serialized after create/update).
    """

    # Full name of the answer author
    author_name = serializers.SerializerMethodField()

    # Email of the answer author
    author_email = serializers.SerializerMethodField()

    # Total vote score (upvotes - downvotes)
    vote_score = serializers.SerializerMethodField()

    # The authenticated user's vote on this answer (+1, -1, or None)
    user_vote = serializers.SerializerMethodField()

    # Total number of replies to this answer
    reply_count = serializers.SerializerMethodField()

    # Nested replies serialized recursively
    replies = serializers.SerializerMethodField()

    # Return only the parent id, not the full object
    parent = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Answer
        fields = [
            'id',
            'question',
            'parent',
            'author_name',
            'author_email',
            'body',
            'code_snippet',
            'code_language',
            'is_accepted',
            'vote_score',
            'user_vote',
            'reply_count',
            'replies',
            'created_at',
            'updated_at',
        ]

    def get_author_name(self, obj):
        """Return the full name of the answer author."""
        return f"{obj.author.first_name} {obj.author.last_name}"

    def get_author_email(self, obj):
        """Return the email of the answer author."""
        return obj.author.email

    def get_vote_score(self, obj):
        """
        Return total vote score from annotation when available (no extra
        query), otherwise fall back to a direct aggregate query.
        The annotation is named vote_score_db to avoid clashing with the
        legacy vote_score annotation produced by _annotate_answers().
        """
        # Preferred: annotation set by get_annotated_answers()
        if hasattr(obj, 'vote_score_db'):
            score = obj.vote_score_db
            return score if score is not None else 0

        # Legacy: annotation set by _annotate_answers()
        if hasattr(obj, 'vote_score'):
            return obj.vote_score

        # Fallback: live query (single-answer contexts such as create/update)
        content_type = ContentType.objects.get_for_model(Answer)
        result = Vote.objects.filter(
            content_type=content_type,
            object_id=obj.id,
        ).aggregate(score=Coalesce(Sum('value'), 0))
        return result['score']

    def get_user_vote(self, obj):
        """
        Return the authenticated user's vote value on this answer.
        Reads from the user_vote_value annotation when present, zero extra
        queries. Falls back to a live query only when the annotation is
        absent (e.g. single-answer serialization after create/update).
        Returns +1, -1, or None if not voted or not authenticated.
        """
        # Preferred: annotation set by get_annotated_answers()
        if hasattr(obj, 'user_vote_value'):
            return obj.user_vote_value  # already None when not voted

        # Fallback: live query (used outside QuestionDetailView.get)
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None

        content_type = ContentType.objects.get_for_model(Answer)
        vote = Vote.objects.filter(
            user=request.user,
            content_type=content_type,
            object_id=obj.id,
        ).first()
        return vote.value if vote else None

    def get_reply_count(self, obj):
        """Return the total number of replies to this answer."""
        if hasattr(obj, 'reply_count'):
            return obj.reply_count
        return obj.replies.count()

    def get_replies(self, obj):
        """
        Serialize nested replies, annotating them with vote_score_db and
        user_vote_value so the recursive AnswerSerializer calls stay
        query free for those fields too.
        """
        prefetched_replies = getattr(obj, 'prefetched_replies', None)
        if prefetched_replies is not None:
            return AnswerSerializer(
                prefetched_replies,
                many=True,
                context=self.context,
            ).data

        request = self.context.get('request')
        answer_content_type = ContentType.objects.get_for_model(Answer)

        # Subquery: total vote score per reply
        vote_score_subquery = (
            Vote.objects.filter(
                content_type=answer_content_type,
                object_id=OuterRef('pk'),
            )
            .values('object_id')
            .annotate(score=Sum('value'))
            .values('score')[:1]
        )

        replies = obj.replies.annotate(
            vote_score_db=Coalesce(
                Subquery(vote_score_subquery, output_field=IntegerField()),
                Value(0),
            ),
            reply_count=Count('replies'),
        ).order_by('created_at')

        # Annotate the current user's vote on each reply when authenticated
        if request and request.user.is_authenticated:
            user_vote_subquery = (
                Vote.objects.filter(
                    content_type=answer_content_type,
                    object_id=OuterRef('pk'),
                    user=request.user,
                )
                .values('value')[:1]
            )
            replies = replies.annotate(
                user_vote_value=Subquery(
                    user_vote_subquery, output_field=IntegerField()
                )
            )

        return AnswerSerializer(replies, many=True, context=self.context).data


class QuestionListSerializer(serializers.ModelSerializer):
    """
    Used for listing questions, minimal data only.
    Does NOT include body, code_snippet, or answers.
    """

    # Full name of the question author
    author_name = serializers.SerializerMethodField()

    # Total number of answers for this question
    answer_count = serializers.SerializerMethodField()

    # Total vote score (upvotes - downvotes)
    vote_score = serializers.SerializerMethodField()

    # True if any answer has been accepted
    has_accepted_answer = serializers.SerializerMethodField()

    # List of tag names associated with this question
    tags = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            'id',
            'title',
            'tags',
            'author_name',
            'answer_count',
            'vote_score',
            'has_accepted_answer',
            'view_count',
            'created_at',
        ]

    def get_author_name(self, obj):
        """Return the full name of the question author."""
        return f"{obj.author.first_name} {obj.author.last_name}"

    def get_answer_count(self, obj):
        """Return the total number of answers for this question."""
        if hasattr(obj, 'answer_count'):
            return obj.answer_count
        return obj.answers.count()

    def get_vote_score(self, obj):
        """
        Return total vote score using annotation if available,
        otherwise fall back to a direct query.
        """
        if hasattr(obj, 'vote_score'):
            return obj.vote_score
        content_type = ContentType.objects.get_for_model(Question)
        result = Vote.objects.filter(
            content_type=content_type,
            object_id=obj.id,
        ).aggregate(score=Coalesce(Sum('value'), 0))
        return result['score']

    def get_has_accepted_answer(self, obj):
        """Return True if this question has an accepted answer."""
        return obj.accepted_answer_id is not None

    def get_tags(self, obj):
        """Return a list of tag names associated with this question."""
        return [tag.name for tag in obj.tags.all()]


class QuestionDetailSerializer(serializers.ModelSerializer):
    """
    Used for single question view — full data.
    Extends list serializer with body, code_snippet, answers and more.
    Includes only top-level answers with their nested replies.
    """

    author_name = serializers.SerializerMethodField()
    author_email = serializers.SerializerMethodField()
    answer_count = serializers.SerializerMethodField()
    vote_score = serializers.SerializerMethodField()
    has_accepted_answer = serializers.SerializerMethodField()

    # True if 24 hours have passed since question creation
    can_accept_answer = serializers.SerializerMethodField()

    # Top-level answers only (parent=None), each with nested replies
    answers = serializers.SerializerMethodField()

    # List of tag names associated with this question
    tags = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            'id',
            'title',
            'tags',
            'author_name',
            'author_email',
            'answer_count',
            'vote_score',
            'has_accepted_answer',
            'view_count',
            'created_at',
            'body',
            'code_snippet',
            'code_language',
            'is_closed',
            'can_accept_answer',
            'answers',
        ]

    def get_author_name(self, obj):
        """Return the full name of the question author."""
        return f"{obj.author.first_name} {obj.author.last_name}"

    def get_author_email(self, obj):
        """Return the email of the question author."""
        return obj.author.email

    def get_answer_count(self, obj):
        """Return the total number of answers for this question."""
        if hasattr(obj, 'answer_count'):
            return obj.answer_count
        return obj.answers.count()

    def get_vote_score(self, obj):
        """
        Return total vote score using annotation if available,
        otherwise fall back to a direct query.
        """
        if hasattr(obj, 'vote_score'):
            return obj.vote_score
        content_type = ContentType.objects.get_for_model(Question)
        result = Vote.objects.filter(
            content_type=content_type,
            object_id=obj.id,
        ).aggregate(score=Coalesce(Sum('value'), 0))
        return result['score']

    def get_has_accepted_answer(self, obj):
        """Return True if this question has an accepted answer."""
        return obj.accepted_answer_id is not None

    def get_can_accept_answer(self, obj):
        """Return True if 24 hours have passed since question creation."""
        return obj.can_accept_answer

    def get_tags(self, obj):
        """Return a list of tag names associated with this question."""
        return [tag.name for tag in obj.tags.all()]

    def get_answers(self, obj):
        """
        Return top-level answers with nested replies via AnswerSerializer.
        Uses the pre-annotated queryset from context when available (set by
        QuestionDetailView.get via get_annotated_answers()).Falls back to
        building the queryset inline for other callers such as POST responses.
        """
        # Fast path: view has already built the annotated queryset
        annotated_answers = self.context.get('annotated_answers')
        if annotated_answers is not None:
            return AnswerSerializer(
                annotated_answers,
                many=True,
                context=self.context,
            ).data

        # Fallback path (e.g. after question create/patch where the full
        # annotation pipeline is not wired up)
        answer_content_type = ContentType.objects.get_for_model(Answer)
        vote_score_subquery = (
            Vote.objects.filter(
                content_type=answer_content_type,
                object_id=OuterRef('pk'),
            )
            .values('object_id')
            .annotate(score=Sum('value'))
            .values('score')[:1]
        )

        top_level_answers = obj.answers.filter(parent=None).annotate(
            vote_score=Coalesce(
                Subquery(vote_score_subquery, output_field=IntegerField()),
                Value(0),
            ),
            reply_count=Count('replies'),
        ).order_by('created_at')

        return AnswerSerializer(
            top_level_answers,
            many=True,
            context=self.context,
        ).data


class QuestionCreateSerializer(serializers.ModelSerializer):
    """
    Used for creating and updating questions.
    Validates title, body and tags format.
    """

    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        default=list,
    )

    class Meta:
        model = Question
        fields = [
            'title',
            'body',
            'code_snippet',
            'code_language',
            'tags',
            'is_closed',
        ]

    def validate_title(self, value):
        """Reject titles that are empty or contain only whitespace."""
        if not value.strip():
            raise serializers.ValidationError('Title cannot be blank.')
        return value

    def validate_body(self, value):
        """Reject bodies that are empty or contain only whitespace."""
        if not value.strip():
            raise serializers.ValidationError('Body cannot be blank.')
        return value

    def validate_tags(self, value):
        """
        Validate that tags is a list of strings,
        max 5 tags, each max 50 characters.
        """
        if not isinstance(value, list):
            raise serializers.ValidationError('Tags must be a list.')
        if len(value) > 5:
            raise serializers.ValidationError(
                'Maximum 5 tags allowed.'
            )
        for tag in value:
            if not isinstance(tag, str):
                raise serializers.ValidationError(
                    'Each tag must be a string.'
                )
            if len(tag) > 50:
                raise serializers.ValidationError(
                    f'Tag "{tag}" exceeds the 50 character limit.'
                )
        return value

    @staticmethod
    def _resolve_tags(tag_names: list[str]) -> list[Tag]:
        """Get or create a Tag row for each name. Subject tags are never created here."""
        tags = []
        for name in tag_names:
            tag, _ = Tag.objects.get_or_create(name=name, defaults={'is_subject': False})
            tags.append(tag)
        return tags

    def create(self, validated_data):
        tag_names = validated_data.pop('tags', [])
        question = Question.objects.create(**validated_data)
        question.tags.set(self._resolve_tags(tag_names))
        return question

    def update(self, instance, validated_data):
        tag_names = validated_data.pop('tags', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tag_names is not None:
            instance.tags.set(self._resolve_tags(tag_names))
        return instance


class AnswerCreateSerializer(serializers.ModelSerializer):
    """
    Used for creating answers and replies.
    Validates that body is not blank.
    """

    parent_id = serializers.PrimaryKeyRelatedField(
        source='parent',
        queryset=Answer.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = Answer
        fields = [
            'body',
            'code_snippet',
            'code_language',
            'parent_id',
        ]

    def validate_body(self, value):
        """Reject bodies that are empty or contain only whitespace."""
        if not value.strip():
            raise serializers.ValidationError('Body cannot be blank.')
        return value

    def validate(self, attrs):
        """Ensure reply parent belongs to the same question when provided."""
        attrs = super().validate(attrs)

        parent = attrs.get('parent')
        question = (
            attrs.get('question')
            or self.context.get('question')
            or getattr(self.instance, 'question', None)
        )

        if parent is not None:
            if question is None:
                raise serializers.ValidationError(
                    {'parent_id': 'Question context is required when parent_id is provided.'}
                )
            if parent.question_id != question.id:
                raise serializers.ValidationError(
                    {'parent_id': 'Parent answer must belong to the same question.'}
                )

        return attrs
