from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Subject, User
from apps.esi_db.models import EsiStudent
from .models import Assignment, AssignmentSubmission, AssignmentSubmissionFile, SubmissionReview


class AssignmentSubmissionApiTests(APITestCase):
    def setUp(self):
        self.subject = Subject.objects.create(name='Algorithms', code='ALGO101')
        self.professor = User.objects.create_user(
            email='prof@test.local',
            password='testpass123',
            first_name='Prof',
            last_name='One',
            role=User.Role.PROFESSOR,
            is_active=True,
            is_verified=True,
        )
        self.student = User.objects.create_user(
            email='student@test.local',
            password='testpass123',
            first_name='Stud',
            last_name='One',
            role=User.Role.STUDENT,
            school_id='2023001',
            is_active=True,
            is_verified=True,
        )
        EsiStudent.objects.create(
            school_id='2023001',
            first_name='Stud',
            last_name='One',
            email='student@test.local',
            section='A',
            group=1,
            study_year='2CP',
            status='inscrit',
        )
        self.assignment = Assignment.objects.create(
            professor=self.professor,
            subject=self.subject,
            title='HW1',
            description='Solve exercises',
            target_year='2CP',
            target_sections=['A'],
            target_groups=[],
            deadline=timezone.now() + timedelta(days=2),
            allow_late=False,
        )

    @patch('apps.assignment_submissions.views.upload_file')
    @patch('apps.assignment_submissions.views.validate_code_file')
    def test_student_submit_creates_submission_with_stable_prefix(
        self,
        mock_validate,
        mock_upload,
    ):
        mock_validate.side_effect = lambda file: file
        self.client.force_authenticate(user=self.student)

        payload = {
            'files': [SimpleUploadedFile('main.py', b'print("ok")\n', content_type='text/plain')],
            'file_paths': ['src/main.py'],
        }

        response = self.client.post(
            reverse('student-submit', kwargs={'pk': self.assignment.id}),
            payload,
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        submission = AssignmentSubmission.objects.get(
            assignment=self.assignment,
            student=self.student,
        )
        expected_prefix = AssignmentSubmission.build_gcs_prefix(
            self.assignment.id,
            self.student.id,
            submission.id,
        )
        self.assertEqual(submission.gcs_prefix, expected_prefix)
        self.assertEqual(submission.files.count(), 1)
        mock_upload.assert_called_once()

    @patch('apps.assignment_submissions.views.delete_directory')
    @patch('apps.assignment_submissions.views.upload_file')
    @patch('apps.assignment_submissions.views.validate_code_file')
    def test_resubmission_replaces_files_and_keeps_same_submission_record(
        self,
        mock_validate,
        mock_upload,
        mock_delete_directory,
    ):
        mock_validate.side_effect = lambda file: file
        self.client.force_authenticate(user=self.student)

        submission = AssignmentSubmission.objects.create(
            assignment=self.assignment,
            student=self.student,
            gcs_prefix='assignments/old/prefix/',
            is_late=False,
        )
        AssignmentSubmissionFile.objects.create(
            submission=submission,
            file_name='old.py',
            file_path='old.py',
            gcs_path='assignments/old/prefix/old.py',
            file_size=10,
        )

        payload = {
            'files': [SimpleUploadedFile('new.py', b'print("new")\n', content_type='text/plain')],
            'file_paths': ['src/new.py'],
        }
        response = self.client.post(
            reverse('student-submit', kwargs={'pk': self.assignment.id}),
            payload,
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        submission.refresh_from_db()

        expected_prefix = AssignmentSubmission.build_gcs_prefix(
            self.assignment.id,
            self.student.id,
            submission.id,
        )
        self.assertEqual(submission.gcs_prefix, expected_prefix)
        self.assertEqual(submission.files.count(), 1)
        self.assertEqual(submission.files.first().file_name, 'new.py')
        mock_delete_directory.assert_called_once_with('assignments/old/prefix/')


class SubmissionReviewApiTests(APITestCase):
    def setUp(self):
        self.subject = Subject.objects.create(name='Databases', code='DB101')
        self.owner_professor = User.objects.create_user(
            email='owner@test.local',
            password='testpass123',
            first_name='Owner',
            last_name='Prof',
            role=User.Role.PROFESSOR,
            is_active=True,
            is_verified=True,
        )
        self.reviewer_professor = User.objects.create_user(
            email='reviewer@test.local',
            password='testpass123',
            first_name='Review',
            last_name='Prof',
            role=User.Role.PROFESSOR,
            is_active=True,
            is_verified=True,
        )
        self.student = User.objects.create_user(
            email='student2@test.local',
            password='testpass123',
            first_name='Stud',
            last_name='Two',
            role=User.Role.STUDENT,
            school_id='2023002',
            is_active=True,
            is_verified=True,
        )

        self.assignment = Assignment.objects.create(
            professor=self.owner_professor,
            subject=self.subject,
            title='HW2',
            description='SQL tasks',
            target_year='2CP',
            target_sections=[],
            target_groups=[1],
            deadline=timezone.now() + timedelta(days=2),
            allow_late=False,
        )
        self.submission = AssignmentSubmission.objects.create(
            assignment=self.assignment,
            student=self.student,
            gcs_prefix='assignments/1/2/3/',
            is_late=False,
        )
        self.submission_file = AssignmentSubmissionFile.objects.create(
            submission=self.submission,
            file_name='main.py',
            file_path='src/main.py',
            gcs_path='assignments/1/2/3/src/main.py',
            file_size=20,
        )

    def test_post_review_endpoint_creates_and_replaces_professor_review(self):
        self.client.force_authenticate(user=self.reviewer_professor)
        url = reverse(
            'submission-review',
            kwargs={'pk': self.assignment.id, 'submission_id': self.submission.id},
        )

        first_payload = {
            'general_comment': 'Good first pass',
            'grade': '15.50',
            'comments': [
                {
                    'file_id': self.submission_file.id,
                    'line_number': 1,
                    'content': 'Use a constant here.',
                }
            ],
        }
        first_response = self.client.post(url, first_payload, format='json')
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)

        review = SubmissionReview.objects.get(
            submission=self.submission,
            professor=self.reviewer_professor,
        )
        self.assertEqual(review.comments.count(), 1)

        second_payload = {
            'general_comment': 'Updated review',
            'grade': '18.00',
            'comments': [
                {
                    'file_id': self.submission_file.id,
                    'line_number': 2,
                    'content': 'Great fix.',
                }
            ],
        }
        second_response = self.client.post(url, second_payload, format='json')
        self.assertEqual(second_response.status_code, status.HTTP_201_CREATED)

        review.refresh_from_db()
        self.assertEqual(
            SubmissionReview.objects.filter(
                submission=self.submission,
                professor=self.reviewer_professor,
            ).count(),
            1,
        )
        self.assertEqual(review.general_comment, 'Updated review')
        self.assertEqual(review.comments.count(), 1)
        self.assertEqual(review.comments.first().line_number, 2)

    def test_submitting_student_can_get_all_reviews(self):
        review = SubmissionReview.objects.create(
            submission=self.submission,
            professor=self.reviewer_professor,
            general_comment='Solid work',
        )
        review.comments.create(
            file=self.submission_file,
            line_number=1,
            content='Nit: simplify this line.',
        )

        self.client.force_authenticate(user=self.student)
        url = reverse(
            'submission-reviews',
            kwargs={'pk': self.assignment.id, 'submission_id': self.submission.id},
        )
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['general_comment'], 'Solid work')

    def test_professor_submission_list_exposes_reviews_count(self):
        SubmissionReview.objects.create(
            submission=self.submission,
            professor=self.reviewer_professor,
            general_comment='Count me',
        )

        self.client.force_authenticate(user=self.owner_professor)
        response = self.client.get(
            reverse('submission-list', kwargs={'pk': self.assignment.id})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        item = response.data['results'][0]
        self.assertEqual(item['reviews_count'], 1)
        self.assertTrue(item['has_reviews'])


class AssignmentListHasSubmittedTests(APITestCase):
    def setUp(self):
        self.subject = Subject.objects.create(name='Networks', code='NET101')
        self.professor = User.objects.create_user(
            email='prof3@test.local',
            password='testpass123',
            first_name='Prof',
            last_name='Three',
            role=User.Role.PROFESSOR,
            is_active=True,
            is_verified=True,
        )
        self.student = User.objects.create_user(
            email='student3@test.local',
            password='testpass123',
            first_name='Stud',
            last_name='Three',
            role=User.Role.STUDENT,
            school_id='2023003',
            is_active=True,
            is_verified=True,
        )
        EsiStudent.objects.create(
            school_id='2023003',
            first_name='Stud',
            last_name='Three',
            email='student3@test.local',
            section='A',
            group=1,
            study_year='2CP',
            status='inscrit',
        )

        self.assignment_with_submission = Assignment.objects.create(
            professor=self.professor,
            subject=self.subject,
            title='NET HW 1',
            description='Submitted one',
            target_year='2CP',
            target_sections=['A'],
            target_groups=[],
            deadline=timezone.now() + timedelta(days=2),
            allow_late=False,
        )
        self.assignment_without_submission = Assignment.objects.create(
            professor=self.professor,
            subject=self.subject,
            title='NET HW 2',
            description='Not submitted yet',
            target_year='2CP',
            target_sections=['A'],
            target_groups=[],
            deadline=timezone.now() + timedelta(days=3),
            allow_late=False,
        )

        AssignmentSubmission.objects.create(
            assignment=self.assignment_with_submission,
            student=self.student,
            gcs_prefix='assignments/seed/prefix/',
            is_late=False,
        )

    def test_student_list_includes_has_submitted_flag(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.get(reverse('assignment-list-create'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results_by_id = {item['id']: item for item in response.data['results']}

        self.assertIn('has_submitted', results_by_id[self.assignment_with_submission.id])
        self.assertTrue(results_by_id[self.assignment_with_submission.id]['has_submitted'])
        self.assertFalse(results_by_id[self.assignment_without_submission.id]['has_submitted'])
