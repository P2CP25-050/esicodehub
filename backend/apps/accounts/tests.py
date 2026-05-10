from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


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
