from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Subject, User
from apps.assignment_submissions.models import (
    Assignment,
    AssignmentSubmission,
    SubmissionReview,
)
from apps.esi_db.models import EsiStudent
from apps.forum.models import Answer, Question, Tag
from .models import Notification


class NotificationApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='notify-user@test.local',
            password='testpass123',
            first_name='Notify',
            last_name='User',
            role=User.Role.STUDENT,
            is_active=True,
            is_verified=True,
        )
        self.other_user = User.objects.create_user(
            email='other-user@test.local',
            password='testpass123',
            first_name='Other',
            last_name='User',
            role=User.Role.STUDENT,
            is_active=True,
            is_verified=True,
        )

    def test_list_returns_latest_30_for_current_user(self):
        base_time = timezone.now()
        for index in range(31):
            notification = Notification.objects.create(
                recipient=self.user,
                type=Notification.Type.FORUM_ANSWER,
                title=f'Notification {index}',
            )
            Notification.objects.filter(pk=notification.pk).update(
                created_at=base_time + timedelta(minutes=index),
            )

        Notification.objects.create(
            recipient=self.other_user,
            type=Notification.Type.FORUM_ANSWER,
            title='Other user notification',
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse('notification-list'))

        expected_ids = list(
            Notification.objects.filter(
                recipient=self.user,
            ).values_list('id', flat=True)[:30]
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 30)
        self.assertEqual(
            [item['id'] for item in response.data],
            expected_ids,
        )

    def test_mark_all_as_read_only_updates_current_user(self):
        Notification.objects.create(
            recipient=self.user,
            type=Notification.Type.FORUM_ANSWER,
            title='First',
        )
        Notification.objects.create(
            recipient=self.user,
            type=Notification.Type.FORUM_COMMENT,
            title='Second',
        )
        other_notification = Notification.objects.create(
            recipient=self.other_user,
            type=Notification.Type.FORUM_ANSWER,
            title='Other',
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.patch(reverse('notification-read-all'))

        other_notification.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['updated'], 2)
        self.assertFalse(
            Notification.objects.filter(
                recipient=self.user,
                is_read=False,
            ).exists()
        )
        self.assertFalse(other_notification.is_read)

    def test_mark_one_as_read_requires_notification_owner(self):
        notification = Notification.objects.create(
            recipient=self.user,
            type=Notification.Type.FORUM_ANSWER,
            title='Mine',
        )
        other_notification = Notification.objects.create(
            recipient=self.other_user,
            type=Notification.Type.FORUM_ANSWER,
            title='Other',
        )

        self.client.force_authenticate(user=self.user)
        other_response = self.client.patch(
            reverse(
                'notification-read',
                kwargs={'pk': other_notification.id},
            )
        )
        own_response = self.client.patch(
            reverse('notification-read', kwargs={'pk': notification.id})
        )

        notification.refresh_from_db()
        other_notification.refresh_from_db()
        self.assertEqual(other_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(own_response.status_code, status.HTTP_200_OK)
        self.assertTrue(notification.is_read)
        self.assertFalse(other_notification.is_read)


class NotificationSignalTests(APITestCase):
    def setUp(self):
        self.professor = User.objects.create_user(
            email='professor@test.local',
            password='testpass123',
            first_name='Ada',
            last_name='Professor',
            role=User.Role.PROFESSOR,
            is_active=True,
            is_verified=True,
        )
        self.student = User.objects.create_user(
            email='student@test.local',
            password='testpass123',
            first_name='Grace',
            last_name='Student',
            role=User.Role.STUDENT,
            school_id='2023001',
            is_active=True,
            is_verified=True,
        )
        self.other_student = User.objects.create_user(
            email='other-student@test.local',
            password='testpass123',
            first_name='Alan',
            last_name='Student',
            role=User.Role.STUDENT,
            school_id='2023002',
            is_active=True,
            is_verified=True,
        )
        self.subject = Subject.objects.create(
            name='Algorithms',
            code='ALGO-NOTIFY',
        )
        self.python_tag = Tag.objects.get_or_create(name='python')[0]

    def test_forum_answer_signal_notifies_question_author(self):
        question = Question.objects.create(
            author=self.student,
            title='How do I sort this?',
            body='I need sorting help.',
        )
        question.tags.set([self.python_tag])

        Answer.objects.create(
            question=question,
            author=self.other_student,
            body='Use sorted().',
        )

        notification = Notification.objects.get(recipient=self.student)
        self.assertEqual(notification.type, Notification.Type.FORUM_ANSWER)
        self.assertEqual(notification.body, question.title)
        self.assertEqual(notification.link, f'/forum/{question.id}')

    def test_forum_reply_signal_notifies_parent_answer_author(self):
        question = Question.objects.create(
            author=self.student,
            title='How do I parse this?',
            body='Parser question.',
        )
        question.tags.set([self.python_tag])
        parent_answer = Answer.objects.create(
            question=question,
            author=self.other_student,
            body='Start with tokens.',
        )
        Notification.objects.all().delete()

        Answer.objects.create(
            question=question,
            parent=parent_answer,
            author=self.student,
            body='Thanks, can you explain more?',
        )

        notification = Notification.objects.get(recipient=self.other_student)
        self.assertEqual(notification.type, Notification.Type.FORUM_COMMENT)
        self.assertEqual(notification.body, question.title)

    def test_assignment_created_signal_notifies_targeted_students(self):
        EsiStudent.objects.create(
            school_id='2023001',
            first_name='Grace',
            last_name='Student',
            email='student@test.local',
            section='A',
            group=1,
            study_year='2CP',
            status='inscrit',
        )
        EsiStudent.objects.create(
            school_id='2023002',
            first_name='Alan',
            last_name='Student',
            email='other-student@test.local',
            section='B',
            group=2,
            study_year='2CP',
            status='inscrit',
        )

        assignment = Assignment.objects.create(
            professor=self.professor,
            subject=self.subject,
            title='Graphs HW',
            description='Shortest paths',
            target_year='2CP',
            target_sections=['A'],
            target_groups=[],
            deadline=timezone.now() + timedelta(days=2),
            allow_late=False,
        )

        notification = Notification.objects.get(recipient=self.student)
        self.assertEqual(
            notification.type,
            Notification.Type.ASSIGNMENT_CREATED,
        )
        self.assertEqual(notification.title, 'New assignment: Graphs HW')
        self.assertEqual(notification.link, f'/assignments/{assignment.id}')
        self.assertFalse(
            Notification.objects.filter(recipient=self.other_student).exists()
        )

    def test_submission_review_signal_notifies_student(self):
        assignment = Assignment.objects.create(
            professor=self.professor,
            subject=self.subject,
            title='DP HW',
            description='Dynamic programming',
            target_year='2CP',
            target_sections=[],
            target_groups=[],
            deadline=timezone.now() + timedelta(days=2),
            allow_late=False,
        )
        submission = AssignmentSubmission.objects.create(
            assignment=assignment,
            student=self.student,
            gcs_prefix='assignments/1/2/3/',
            is_late=False,
        )

        SubmissionReview.objects.create(
            submission=submission,
            professor=self.professor,
            general_comment='Good work',
        )

        notification = Notification.objects.get(recipient=self.student)
        self.assertEqual(
            notification.type,
            Notification.Type.ASSIGNMENT_REVIEWED,
        )
        self.assertEqual(notification.body, assignment.title)
        self.assertEqual(
            notification.link,
            f'/assignments/{assignment.id}/submissions/{submission.id}',
        )
