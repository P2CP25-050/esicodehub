from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Subject, User
from apps.assignment_submissions.models import Assignment, AssignmentSubmission
from apps.plagiarism.models import PlagiarismReport, SimilarityMatch


class SimilarityMatchModelTests(TestCase):
    def setUp(self):
        self.professor = User.objects.create_user(
            email='prof@example.com',
            password='pass1234',
            role='professor',
            first_name='Prof',
            last_name='One',
            is_active=True,
            is_verified=True,
        )
        self.student1 = User.objects.create_user(
            email='student1@example.com',
            password='pass1234',
            role='student',
            first_name='Student',
            last_name='One',
            is_active=True,
            is_verified=True,
        )
        self.student2 = User.objects.create_user(
            email='student2@example.com',
            password='pass1234',
            role='student',
            first_name='Student',
            last_name='Two',
            is_active=True,
            is_verified=True,
        )

        subject = Subject.objects.create(name='Algorithms', code='ALGO101')

        self.assignment_1 = Assignment.objects.create(
            professor=self.professor,
            subject=subject,
            title='A1',
            description='Assignment 1',
            target_year='1CS',
            languages=['python'],
            deadline=timezone.now() + timedelta(days=2),
            allow_late=False,
        )
        self.assignment_2 = Assignment.objects.create(
            professor=self.professor,
            subject=subject,
            title='A2',
            description='Assignment 2',
            target_year='1CS',
            languages=['python'],
            deadline=timezone.now() + timedelta(days=3),
            allow_late=False,
        )

        self.report = PlagiarismReport.objects.create(
            assignment=self.assignment_1,
            status=PlagiarismReport.Status.PENDING,
            triggered_by=self.professor,
        )

        self.submission_1 = AssignmentSubmission.objects.create(
            assignment=self.assignment_1,
            student=self.student1,
            gcs_prefix='assignments/1/1/1/',
        )
        self.submission_2 = AssignmentSubmission.objects.create(
            assignment=self.assignment_1,
            student=self.student2,
            gcs_prefix='assignments/1/2/2/',
        )
        self.submission_other_assignment = AssignmentSubmission.objects.create(
            assignment=self.assignment_2,
            student=self.student1,
            gcs_prefix='assignments/2/1/1/',
        )

    def _make_match(self, **overrides):
        data = {
            'report': self.report,
            'submission_a': self.submission_1,
            'submission_b': self.submission_2,
            'language': 'python',
            'similarity_a': 85,
            'similarity_b': 80,
            'lines_matched': 40,
            'moss_link': 'https://moss.stanford.edu/result/123',
        }
        data.update(overrides)
        return SimilarityMatch(**data)

    def test_rejects_self_match(self):
        match = self._make_match(submission_b=self.submission_1)

        with self.assertRaises(ValidationError):
            match.save()

    def test_rejects_submission_from_other_assignment(self):
        match = self._make_match(submission_b=self.submission_other_assignment)

        with self.assertRaises(ValidationError):
            match.save()

    def test_normalizes_pair_order_and_swaps_scores(self):
        match = self._make_match(
            submission_a=self.submission_2,
            submission_b=self.submission_1,
            similarity_a=70,
            similarity_b=90,
        )
        match.save()

        self.assertEqual(match.submission_a_id, self.submission_1.id)
        self.assertEqual(match.submission_b_id, self.submission_2.id)
        self.assertEqual(match.similarity_a, 90)
        self.assertEqual(match.similarity_b, 70)

    def test_rejects_duplicate_pair_language_in_same_report(self):
        self._make_match().save()
        duplicate = self._make_match(
            submission_a=self.submission_2,
            submission_b=self.submission_1,
        )

        with self.assertRaises((ValidationError, IntegrityError)):
            duplicate.save()

    def test_rejects_similarity_out_of_range(self):
        match = self._make_match(similarity_a=101)

        with self.assertRaises(ValidationError):
            match.save()

    def test_rejects_negative_lines_matched(self):
        match = self._make_match(lines_matched=-1)

        with self.assertRaises(ValidationError):
            match.save()
