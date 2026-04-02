from django.conf import settings
from django.contrib.auth import get_user_model
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
