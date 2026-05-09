import base64

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import Profile
from apps.esi_db.models import EsiStudent
from apps.forum.models import Answer, Question
from apps.personal_submissions.models import PersonalSubmission

User = get_user_model()


class AuthCookieFlowTests(APITestCase):
    def setUp(self):
        self.password = 'StrongPass123!'
        self.user = User.objects.create_user(
            email='student@esi.dz',
            password=self.password,
            first_name='Test',
            last_name='Student',
            school_id='22CS001',
            role=User.Role.STUDENT,
            is_active=True,
            is_verified=True,
        )

        self.login_url = reverse('login')
        self.refresh_url = reverse('token-refresh')
        self.logout_url = reverse('logout')

    def test_login_sets_refresh_cookie_and_returns_access(self):
        response = self.client.post(
            self.login_url,
            {'email': self.user.email, 'password': self.password},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertNotIn('refresh', response.data)
        self.assertIn('user', response.data)

        cookie_name = settings.AUTH_REFRESH_COOKIE_NAME
        self.assertIn(cookie_name, response.cookies)

        refresh_cookie = response.cookies[cookie_name]
        self.assertTrue(refresh_cookie['httponly'])
        self.assertEqual(refresh_cookie['path'], settings.AUTH_REFRESH_COOKIE_PATH)
        self.assertEqual(refresh_cookie['samesite'], settings.AUTH_COOKIE_SAMESITE)

    def test_token_refresh_uses_http_only_cookie(self):
        login_response = self.client.post(
            self.login_url,
            {'email': self.user.email, 'password': self.password},
            format='json',
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        refresh_response = self.client.post(self.refresh_url, {}, format='json')
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn('access', refresh_response.data)

    def test_token_refresh_without_cookie_is_unauthorized(self):
        response = self.client.post(self.refresh_url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data.get('detail'), 'No refresh token cookie found.')

    def test_logout_clears_refresh_cookie_and_session_cannot_refresh(self):
        login_response = self.client.post(
            self.login_url,
            {'email': self.user.email, 'password': self.password},
            format='json',
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        logout_response = self.client.post(self.logout_url, {}, format='json')
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)

        cookie_name = settings.AUTH_REFRESH_COOKIE_NAME
        self.assertIn(cookie_name, logout_response.cookies)

        cleared_cookie = logout_response.cookies[cookie_name]
        self.assertEqual(cleared_cookie.value, '')
        self.assertEqual(cleared_cookie['path'], settings.AUTH_REFRESH_COOKIE_PATH)

        refresh_response = self.client.post(self.refresh_url, {}, format='json')
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)


class ProfileAvatarTests(APITestCase):
    def setUp(self):
        self.password = 'StrongPass123!'
        self.user = User.objects.create_user(
            email='avatar-user@esi.dz',
            password=self.password,
            first_name='Avatar',
            last_name='Tester',
            school_id='22CS999',
            role=User.Role.STUDENT,
            is_active=True,
            is_verified=True,
        )
        self.profile_url = reverse('profile')

    def _auth(self):
        login_response = self.client.post(
            reverse('login'),
            {'email': self.user.email, 'password': self.password},
            format='json',
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

    def test_profile_avatar_upload_is_stored_in_db_and_returned_as_data_url(self):
        self._auth()

        png_1x1 = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
            b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04'
            b'\x00\x01\x0b\x0e-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        avatar = SimpleUploadedFile('avatar.png', png_1x1, content_type='image/png')

        patch_response = self.client.patch(
            self.profile_url,
            {'avatar': avatar},
            format='multipart',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        returned_avatar = patch_response.data['profile']['avatar']
        self.assertTrue(returned_avatar.startswith('data:image/png;base64,'))

        self.user.refresh_from_db()
        self.assertEqual(self.user.profile.avatar_content_type, 'image/png')
        self.assertTrue(bool(self.user.profile.avatar_data))
        self.assertFalse(bool(self.user.profile.avatar))

        get_response = self.client.get(self.profile_url)
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data['profile']['avatar'], returned_avatar)

    def test_profile_avatar_rejects_invalid_content_type(self):
        self._auth()

        invalid_file = SimpleUploadedFile('avatar.gif', b'GIF89a', content_type='image/gif')
        response = self.client.patch(
            self.profile_url,
            {'avatar': invalid_file},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Only .jpg, .png, and .webp files are allowed.', response.data['avatar'])


class PublicProfileApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.student = User.objects.create_user(
            email='amine.bensalem@esi.dz',
            password='pass1234',
            role='student',
            first_name='Amine',
            last_name='Bensalem',
            school_id='23/0145',
            is_active=True,
            is_verified=True,
        )
        self.professor = User.objects.create_user(
            email='prof.alami@esi.dz',
            password='pass1234',
            role='professor',
            first_name='Nadia',
            last_name='Alami',
            school_id='20/0001',
            is_active=True,
            is_verified=True,
        )

        profile, _ = Profile.objects.get_or_create(user=self.student)
        profile.bio = 'Student bio'
        profile.avatar_data = base64.b64encode(b'avatar-bytes').decode('ascii')
        profile.avatar_content_type = 'image/png'
        profile.save(update_fields=['bio', 'avatar_data', 'avatar_content_type'])

        EsiStudent.objects.create(
            school_id='23/0145',
            first_name='Amine',
            last_name='Bensalem',
            email=self.student.email,
            section='A',
            group=3,
            study_year='2CS',
            status=EsiStudent.Status.INSCRIT,
        )

        for index in range(6):
            PersonalSubmission.objects.create(
                owner=self.student,
                title=f'Public submission {index + 1}',
                description='Public description',
                language='python',
                submission_type=PersonalSubmission.SubmissionType.REVIEW,
                visibility=PersonalSubmission.Visibility.PUBLIC,
                gcs_prefix=f'personal/{self.student.id}/{index + 1}/',
            )

            question = Question.objects.create(
                author=self.student,
                title=f'Question {index + 1}',
                body='Question body',
            )
            question.tags.set(['python'])
            Answer.objects.create(
                question=question,
                author=self.student,
                body=f'Answer {index + 1}',
                is_accepted=index % 2 == 0,
            )

        PersonalSubmission.objects.create(
            owner=self.student,
            title='Private submission',
            description='Private description',
            language='python',
            submission_type=PersonalSubmission.SubmissionType.HELP,
            visibility=PersonalSubmission.Visibility.PRIVATE,
            gcs_prefix=f'personal/{self.student.id}/private/',
        )
        self.client.force_authenticate(user=self.student)

    def test_public_profile_filters_private_submissions_and_hides_professor_fields(self):
        response = self.client.get(f'/api/profiles/{self.student.school_id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['school_id'], self.student.school_id)
        self.assertEqual(response.data['bio'], 'Student bio')
        self.assertEqual(response.data['study_year'], '2CS')
        self.assertEqual(response.data['section'], 'A')
        self.assertEqual(response.data['group'], 3)
        self.assertIn('avatar', response.data)

        self.assertEqual(response.data['stats']['submissions_count'], 6)
        self.assertEqual(response.data['stats']['questions_count'], 6)
        self.assertEqual(response.data['stats']['answers_count'], 6)
        self.assertEqual(response.data['stats']['accepted_answers_count'], 3)

        recent_activity = response.data['recent_activity']
        self.assertEqual(len(recent_activity['submissions']), 5)
        self.assertEqual(len(recent_activity['questions']), 5)
        self.assertEqual(len(recent_activity['answers']), 5)
        self.assertEqual(recent_activity['submissions'][0]['title'], 'Public submission 6')
        titles = {item['title'] for item in recent_activity['submissions']}
        self.assertNotIn('Private submission', titles)

    def test_public_profile_omits_student_fields_for_professor(self):
        response = self.client.get(f'/api/profiles/{self.professor.school_id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('study_year', response.data)
        self.assertNotIn('section', response.data)
        self.assertNotIn('group', response.data)
        self.assertEqual(response.data['recent_activity'], {})


class PublicProfileSearchApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.requester = User.objects.create_user(
            email='requester@esi.dz',
            password='pass1234',
            role='student',
            first_name='Requester',
            last_name='User',
            school_id='00/0000',
            is_active=True,
            is_verified=True,
        )
        self.client.force_authenticate(user=self.requester)

    def test_search_returns_only_verified_users_and_limits_results(self):
        for index in range(21):
            User.objects.create_user(
                email=f'amine{index}@esi.dz',
                password='pass1234',
                role='student',
                first_name='Amine',
                last_name=f'Alpha{index:02d}',
                school_id=f'24/{index:04d}',
                is_active=True,
                is_verified=True,
            )

        User.objects.create_user(
            email='unverified.amine@esi.dz',
            password='pass1234',
            role='student',
            first_name='Amine',
            last_name='Hidden',
            school_id='24/9999',
            is_active=False,
            is_verified=False,
        )

        response = self.client.get('/api/profiles/search/?q=amine')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 20)
        self.assertTrue(all(item['role'] == 'student' for item in response.data))
        self.assertNotIn('24/9999', {item['school_id'] for item in response.data})

    def test_search_matches_school_id(self):
        user = User.objects.create_user(
            email='school.match@esi.dz',
            password='pass1234',
            role='professor',
            first_name='Nada',
            last_name='Messaoudi',
            school_id='99/0001',
            is_active=True,
            is_verified=True,
        )

        response = self.client.get('/api/profiles/search/?q=99/0001')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['school_id'], user.school_id)
        self.assertEqual(response.data[0]['study_year'], None)
