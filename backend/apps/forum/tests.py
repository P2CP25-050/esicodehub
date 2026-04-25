from django.test import TestCase

from apps.accounts.models import User
from apps.forum.models import Answer, Question
from apps.forum.serializers import AnswerCreateSerializer, QuestionCreateSerializer


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
