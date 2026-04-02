from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from .models import PersonalSubmission
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


class FileValidatorTests(APITestCase):
	@patch('apps.personal_submissions.validators.magic.from_buffer', return_value='application/octet-stream')
	def test_validator_allows_known_text_extension_with_utf8_content(self, _mock_magic):
		file = SimpleUploadedFile('config.yaml', b'key: value\n')
		validated = validate_code_file(file)
		self.assertIs(validated, file)

	@patch('apps.personal_submissions.validators.magic.from_buffer', return_value='application/octet-stream')
	def test_validator_rejects_binary_content(self, _mock_magic):
		file = SimpleUploadedFile('config.yaml', b'\x00\x01\x02\x03')
		with self.assertRaisesMessage(Exception, 'Security Error'):
			validate_code_file(file)
