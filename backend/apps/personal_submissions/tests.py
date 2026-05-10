import json
import os
import tempfile
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.notifications.models import Notification
from .models import PersonalSubmission, SubmissionComment
from .gcs import validate_gcs_configuration
from .validators import validate_code_file


class FileUploadViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='student@test.local',
            password='testpass123',
            first_name='Test',
            last_name='Student',
            is_active=True,
            is_verified=True,
        )
        self.client.force_authenticate(user=self.user)
        self.submission = PersonalSubmission.objects.create(
            owner=self.user,
            title='Submission',
            description='desc',
            language='python',
            course_tag='CS101',
            submission_type=PersonalSubmission.SubmissionType.REVIEW,
            visibility=PersonalSubmission.Visibility.PRIVATE,
            gcs_prefix=PersonalSubmission.build_gcs_prefix(self.user.id, 1),
        )
        self.url = reverse('upload-files', kwargs={'pk': self.submission.id})

    @patch('apps.personal_submissions.views.upload_file')
    @patch('apps.personal_submissions.views.validate_code_file')
    def test_upload_files_success(self, mock_validate, mock_upload):
        mock_validate.side_effect = lambda file: file

        payload = {
            'files': [SimpleUploadedFile('main.py', b'print("ok")\n', content_type='text/plain')],
            'file_paths': ['src/main.py'],
        }
        response = self.client.post(self.url, payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.submission.files.count(), 1)
        mock_upload.assert_called_once()

    def test_upload_rejects_mismatched_file_paths(self):
        payload = {
            'files': [SimpleUploadedFile('main.py', b'print("ok")\n', content_type='text/plain')],
            'file_paths': [],
        }
        response = self.client.post(self.url, payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'Number of files and file_paths must match')

    def test_upload_rejects_path_traversal(self):
        payload = {
            'files': [SimpleUploadedFile('main.py', b'print("ok")\n', content_type='text/plain')],
            'file_paths': ['../secret.py'],
        }
        response = self.client.post(self.url, payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid file path', response.data['detail'])


class PersonalSubmissionListSecurityTests(APITestCase):
    def setUp(self):
        self.user_one = User.objects.create_user(
            email='student1@test.local',
            password='testpass123',
            first_name='Student',
            last_name='One',
            is_active=True,
            is_verified=True,
        )
        self.user_two = User.objects.create_user(
            email='student2@test.local',
            password='testpass123',
            first_name='Student',
            last_name='Two',
            is_active=True,
            is_verified=True,
        )
        self.own_submission = PersonalSubmission.objects.create(
            owner=self.user_one,
            title='Mine',
            description='desc',
            language='python',
            course_tag='CS101',
            submission_type=PersonalSubmission.SubmissionType.REVIEW,
            visibility=PersonalSubmission.Visibility.PUBLIC,
            gcs_prefix=PersonalSubmission.build_gcs_prefix(
                self.user_one.id,
                1,
            ),
        )
        self.other_submission = PersonalSubmission.objects.create(
            owner=self.user_two,
            title='Other',
            description='desc',
            language='python',
            course_tag='CS102',
            submission_type=PersonalSubmission.SubmissionType.SHARING,
            visibility=PersonalSubmission.Visibility.PUBLIC,
            gcs_prefix=PersonalSubmission.build_gcs_prefix(
                self.user_two.id,
                2,
            ),
        )

    def test_list_includes_public_and_own_submissions(self):
        self.client.force_authenticate(user=self.user_one)

        response = self.client.get(reverse('submission-list-create'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        result_ids = {item['id'] for item in response.data['results']}
        self.assertSetEqual(
            result_ids,
            {self.own_submission.id, self.other_submission.id},
        )

    def test_list_mine_only_returns_own_submissions(self):
        self.client.force_authenticate(user=self.user_one)

        response = self.client.get(
            reverse('submission-list-create'),
            {'mine': 'true'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], self.own_submission.id)


class FileValidatorTests(APITestCase):
    @patch(
            'apps.personal_submissions.validators.magic.from_buffer',
            return_value='application/octet-stream'
    )
    def test_validator_allows_known_text_extension_with_utf8_content(self, _mock_magic):
        file = SimpleUploadedFile('config.yaml', b'key: value\n')
        validated = validate_code_file(file)
        self.assertIs(validated, file)

    @patch(
            'apps.personal_submissions.validators.magic.from_buffer',
            return_value='application/octet-stream'
    )
    def test_validator_rejects_binary_content(self, _mock_magic):
        file = SimpleUploadedFile('config.yaml', b'\x00\x01\x02\x03')
        with self.assertRaisesMessage(Exception, 'Security Error'):
            validate_code_file(file)


class GCSConfigurationValidationTests(APITestCase):
    @patch.dict(os.environ, {}, clear=True)
    @patch('apps.personal_submissions.gcs.settings', create=True)
    def test_validation_reports_missing_bucket_and_credentials(self, settings_mock):
        settings_mock.GS_BUCKET_NAME = ''
        settings_mock.GCS_CREDENTIALS_PATH = None
        settings_mock.GS_CREDENTIALS = None

        issues = validate_gcs_configuration()

        self.assertTrue(any('GCS_BUCKET_NAME is not set' in issue for issue in issues))
        self.assertTrue(any('GCS credentials are not configured' in issue for issue in issues))

    @patch('apps.personal_submissions.gcs.settings', create=True)
    def test_validation_reports_windows_host_path_misconfiguration(self, settings_mock):
        settings_mock.GS_BUCKET_NAME = 'bucket'
        settings_mock.GCS_CREDENTIALS_PATH = r'C:\Users\student\gcs-credentials.json'
        settings_mock.GS_CREDENTIALS = r'C:\Users\student\gcs-credentials.json'

        issues = validate_gcs_configuration()

        self.assertTrue(any('host path' in issue for issue in issues))

    @patch('apps.personal_submissions.gcs.settings', create=True)
    def test_validation_passes_for_existing_json_credentials_file(self, settings_mock):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as handle:
            json.dump({'type': 'service_account', 'client_email': 'a@b.c'}, handle)
            credentials_path = handle.name

        try:
            settings_mock.GS_BUCKET_NAME = 'bucket'
            settings_mock.GCS_CREDENTIALS_PATH = credentials_path
            settings_mock.GS_CREDENTIALS = credentials_path

            issues = validate_gcs_configuration()
            self.assertEqual(issues, [])
        finally:
            os.unlink(credentials_path)


class SubmissionCommentTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@test.local',
            password='testpass123',
            first_name='Owner',
            last_name='User',
            is_active=True,
            is_verified=True,
        )
        self.commenter = User.objects.create_user(
            email='commenter@test.local',
            password='testpass123',
            first_name='Commenter',
            last_name='User',
            is_active=True,
            is_verified=True,
        )
        self.private_submission = PersonalSubmission.objects.create(
            owner=self.owner,
            title='Private submission',
            description='desc',
            language='python',
            course_tag='CS101',
            submission_type=PersonalSubmission.SubmissionType.REVIEW,
            visibility=PersonalSubmission.Visibility.PRIVATE,
            gcs_prefix=PersonalSubmission.build_gcs_prefix(self.owner.id, 1),
        )
        self.public_submission = PersonalSubmission.objects.create(
            owner=self.owner,
            title='Public submission',
            description='desc',
            language='python',
            course_tag='CS101',
            submission_type=PersonalSubmission.SubmissionType.REVIEW,
            visibility=PersonalSubmission.Visibility.PUBLIC,
            gcs_prefix=PersonalSubmission.build_gcs_prefix(self.owner.id, 2),
        )

    def test_comment_list_returns_author_details_and_avatar(self):
        self.commenter.profile.avatar_data = 'YQ=='
        self.commenter.profile.avatar_content_type = 'image/png'
        self.commenter.profile.save(update_fields=['avatar_data', 'avatar_content_type'])
        SubmissionComment.objects.create(
            submission=self.public_submission,
            author=self.commenter,
            line_number=12,
            body='Consider simplifying this loop.',
        )

        self.client.force_authenticate(user=self.commenter)
        response = self.client.get('/api/submissions/{}/comments/'.format(self.public_submission.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['author_name'], 'Commenter User')
        self.assertEqual(response.data[0]['author_email'], 'commenter@test.local')
        self.assertTrue(response.data[0]['author_avatar'].startswith('data:image/png;base64,'))

    def test_comment_create_and_delete_are_restricted_and_work_for_owner(self):
        self.client.force_authenticate(user=self.commenter)
        create_response = self.client.post(
            '/api/submissions/{}/comments/'.format(self.public_submission.id),
            {'line_number': 7, 'body': 'Great point here.'},
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        comment_id = create_response.data['id']

        delete_response = self.client.delete(
            '/api/submissions/{}/comments/{}/'.format(self.public_submission.id, comment_id)
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_private_submission_comments_are_forbidden_for_non_owner(self):
        self.client.force_authenticate(user=self.commenter)

        response = self.client.get('/api/submissions/{}/comments/'.format(self.private_submission.id))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_comment_creates_notification_for_submission_owner(self):
        self.client.force_authenticate(user=self.commenter)

        response = self.client.post(
            '/api/submissions/{}/comments/'.format(self.public_submission.id),
            {'line_number': 10, 'body': 'Please rename this variable.'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        notification = Notification.objects.get(recipient=self.owner)
        self.assertEqual(notification.type, Notification.Type.SUBMISSION_COMMENTED)
        self.assertIn('commented on line 10', notification.body)
        self.assertEqual(notification.link, '/submissions/{}'.format(self.public_submission.id))

    def test_comment_does_not_notify_when_owner_comments_own_submission(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            '/api/submissions/{}/comments/'.format(self.public_submission.id),
            {'line_number': 3, 'body': 'Owner note.'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(Notification.objects.filter(recipient=self.owner).exists())
