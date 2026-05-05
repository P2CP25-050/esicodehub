from django.contrib.contenttypes.models import ContentType
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.accounts.models import User
from apps.forum.models import Answer, Question, QuestionView, Vote
from apps.forum.serializers import AnswerCreateSerializer, QuestionCreateSerializer
from apps.forum.views import AnswerCreateView, QuestionDetailView, QuestionListCreateView


class AnswerCreateSerializerTests(TestCase):
    def setUp(self):
        self.professor = User.objects.create_user(
            email='prof@example.com',
            password='pass1234',
            role='professor',
            first_name='Prof',
            last_name='User',
            is_active=True,
            is_verified=True,
        )
        self.student = User.objects.create_user(
            email='student@example.com',
            password='pass1234',
            role='student',
            first_name='Student',
            last_name='User',
            is_active=True,
            is_verified=True,
        )

        self.question_1 = Question.objects.create(
            author=self.student,
            title='Q1',
            body='Question 1 body',
            tags=['python'],
        )
        self.question_2 = Question.objects.create(
            author=self.student,
            title='Q2',
            body='Question 2 body',
            tags=['python'],
        )
        self.parent_answer = Answer.objects.create(
            question=self.question_1,
            author=self.student,
            body='Parent answer',
        )

    def test_accepts_parent_id_for_reply(self):
        serializer = AnswerCreateSerializer(
            data={
                'body': 'Reply body',
                'parent_id': self.parent_answer.id,
            },
            context={'question': self.question_1},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['parent'].id, self.parent_answer.id)

    def test_rejects_parent_from_different_question(self):
        serializer = AnswerCreateSerializer(
            data={
                'body': 'Reply body',
                'parent_id': self.parent_answer.id,
            },
            context={'question': self.question_2},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('parent_id', serializer.errors)

    def test_rejects_parent_without_question_context(self):
        serializer = AnswerCreateSerializer(
            data={
                'body': 'Reply body',
                'parent_id': self.parent_answer.id,
            },
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('parent_id', serializer.errors)


class QuestionCreateSerializerTests(TestCase):
    def test_rejects_blank_title(self):
        serializer = QuestionCreateSerializer(
            data={
                'title': '   ',
                'body': 'Valid body',
                'tags': ['python'],
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('title', serializer.errors)

    def test_rejects_blank_body(self):
        serializer = QuestionCreateSerializer(
            data={
                'title': 'Valid title',
                'body': '   ',
                'tags': ['python'],
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('body', serializer.errors)

    def test_rejects_more_than_five_tags(self):
        serializer = QuestionCreateSerializer(
            data={
                'title': 'Valid title',
                'body': 'Valid body',
                'tags': ['a', 'b', 'c', 'd', 'e', 'f'],
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('tags', serializer.errors)

    def test_accepts_valid_payload(self):
        serializer = QuestionCreateSerializer(
            data={
                'title': 'How to parse input?',
                'body': 'I need help with parser design.',
                'tags': ['python', 'parsing'],
                'code_snippet': 'print("hello")',
                'code_language': 'python',
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)


class QuestionListApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        ContentType.objects.get_for_model(Question)
        self.student = User.objects.create_user(
            email='student@example.com',
            password='pass1234',
            role='student',
            first_name='Student',
            last_name='User',
            is_active=True,
            is_verified=True,
        )
        self.voter = User.objects.create_user(
            email='voter@example.com',
            password='pass1234',
            role='student',
            first_name='Voter',
            last_name='User',
            is_active=True,
            is_verified=True,
        )

        self.newest_question = Question.objects.create(
            author=self.student,
            title='Newest question',
            body='Newest body',
            tags=['python'],
        )
        self.unanswered_question = Question.objects.create(
            author=self.student,
            title='Unanswered question',
            body='Unanswered body',
            tags=['python'],
        )
        self.answered_question = Question.objects.create(
            author=self.student,
            title='Answered question',
            body='Answered body',
            tags=['python'],
        )
        Answer.objects.create(
            question=self.answered_question,
            author=self.student,
            body='Answer body',
        )

        question_content_type = ContentType.objects.get_for_model(Question)
        Vote.objects.create(
            user=self.voter,
            content_type=question_content_type,
            object_id=self.newest_question.id,
            value=1,
        )
        Vote.objects.create(
            user=self.voter,
            content_type=question_content_type,
            object_id=self.unanswered_question.id,
            value=-1,
        )

    def test_newest_order_is_annotation_backed(self):
        request = self.factory.get('/api/forum/questions/?ordering=newest')
        force_authenticate(request, user=self.student)

        with self.assertNumQueries(2):
            response = QuestionListCreateView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item['title'] for item in response.data['results']],
            [
                'Answered question',
                'Unanswered question',
                'Newest question',
            ],
        )
        self.assertEqual(response.data['results'][2]['vote_score'], 1)

    def test_unanswered_order_is_annotation_backed(self):
        request = self.factory.get('/api/forum/questions/?ordering=unanswered')
        force_authenticate(request, user=self.student)

        with self.assertNumQueries(2):
            response = QuestionListCreateView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 2)
        self.assertTrue(all(item['answer_count'] == 0 for item in response.data['results']))


class AnswerCreateApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        ContentType.objects.get_for_model(Answer)
        self.student = User.objects.create_user(
            email='student@example.com',
            password='pass1234',
            role='student',
            first_name='Student',
            last_name='User',
            is_active=True,
            is_verified=True,
        )
        self.other_student = User.objects.create_user(
            email='other@example.com',
            password='pass1234',
            role='student',
            first_name='Other',
            last_name='User',
            is_active=True,
            is_verified=True,
        )

        self.question_1 = Question.objects.create(
            author=self.student,
            title='Question 1',
            body='Body 1',
            tags=['python'],
        )
        self.question_2 = Question.objects.create(
            author=self.student,
            title='Question 2',
            body='Body 2',
            tags=['python'],
        )
        self.parent_answer = Answer.objects.create(
            question=self.question_1,
            author=self.other_student,
            body='Parent answer',
        )

    def test_rejects_parent_from_other_question_via_endpoint(self):
        request = self.factory.post(
            f'/api/forum/questions/{self.question_2.id}/answers/',
            {
                'body': 'Reply body',
                'parent_id': self.parent_answer.id,
            },
            format='json',
        )
        force_authenticate(request, user=self.student)

        response = AnswerCreateView.as_view()(request, pk=self.question_2.id)

        self.assertEqual(response.status_code, 400)
        self.assertIn('parent_id', response.data)


class QuestionDetailViewCountTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.author = User.objects.create_user(
            email='author@example.com',
            password='pass1234',
            role='student',
            first_name='Author',
            last_name='User',
            is_active=True,
            is_verified=True,
        )
        self.viewer = User.objects.create_user(
            email='viewer@example.com',
            password='pass1234',
            role='student',
            first_name='Viewer',
            last_name='User',
            is_active=True,
            is_verified=True,
        )
        self.question = Question.objects.create(
            author=self.author,
            title='View count test',
            body='View count body',
            tags=['python'],
        )

    def _get_question(self, user):
        request = self.factory.get(
            f'/api/forum/questions/{self.question.id}/'
        )
        force_authenticate(request, user=user)
        return QuestionDetailView.as_view()(request, pk=self.question.id)

    def test_author_view_does_not_increment(self):
        response = self._get_question(self.author)

        self.assertEqual(response.status_code, 200)
        self.question.refresh_from_db(fields=['view_count'])
        self.assertEqual(self.question.view_count, 0)
        self.assertFalse(
            QuestionView.objects.filter(
                question=self.question,
                user=self.author,
            ).exists()
        )

    def test_viewer_increments_once(self):
        response = self._get_question(self.viewer)

        self.assertEqual(response.status_code, 200)
        self.question.refresh_from_db(fields=['view_count'])
        self.assertEqual(self.question.view_count, 1)
        self.assertTrue(
            QuestionView.objects.filter(
                question=self.question,
                user=self.viewer,
            ).exists()
        )

        response = self._get_question(self.viewer)

        self.assertEqual(response.status_code, 200)
        self.question.refresh_from_db(fields=['view_count'])
        self.assertEqual(self.question.view_count, 1)
