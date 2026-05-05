# Sprint 1 — Authentication Issues

---

## BACKEND ISSUES

---

### Issue 1: [Backend] Custom User Model

**Labels:** `backend`, `models`, `auth`
**Branch:** `backend/user-model`

#### Description
Implement the custom `User` model that will serve as the foundation for all authentication in the platform. This model replaces Django's default User and uses email as the primary login identifier instead of username. Every other model in the project that references a user must use this model.

#### Technical Notes
- Extend `AbstractUser` from `django.contrib.auth.models`
- Set `USERNAME_FIELD = 'email'` and `REQUIRED_FIELDS = []`
- Implement a custom `UserManager` that overrides `create_user` and `create_superuser` to use email instead of username
- Fields to include:
  - `email` — unique, used for login
  - `password` — handled by AbstractUser
  - `first_name`, `last_name` — copied from mock DB on registration
  - `role` — CharField with choices: `student`, `professor`
  - `school_id` — CharField, stores `yy/xxxx` for students or 7-digit ID for professors
  - `is_verified` — BooleanField, default `False`
  - `created_at` — DateTimeField, auto_now_add
- Remove `username` field entirely by setting `username = None`
- Register model in `apps/accounts/admin.py` using `UserAdmin`
- Add `AUTH_USER_MODEL = 'accounts.User'` to settings (already done)
- Run `python manage.py makemigrations accounts` after implementation

#### Related Issues
- Depends on: nothing (this is the foundation)
- Blocks: all other auth issues

---

### Issue 2: [Backend] EsiStudent and EsiProfessor Mock DB Models

**Labels:** `backend`, `models`, `mock-db`
**Branch:** `backend/esi-mock-db`

#### Description
Implement the read-only mock ESI database models that represent the school's student and professor records. These models are used only during registration to verify that a person exists in the ESI system. They should never be modified by the application — they are seeded once and treated as reference data.

#### Technical Notes
- Create a new app: `python manage.py startapp esi_db` inside `apps/`
- Add `esi_db` to `INSTALLED_APPS` in settings

**`EsiStudent` model:**
- `school_id` — CharField, primary key, format `yy/xxxx` (e.g. `23/0145`)
- `first_name` — CharField
- `last_name` — CharField
- `email` — EmailField, unique
- `section` — CharField (A, B, C, D...)
- `group` — IntegerField (1, 2, 3...)
- `study_year` — IntegerField (1 through 5)
- `status` — CharField with choices: `active`, `inactive`, `alumni`

**`EsiProfessor` model:**
- `school_id` — CharField, primary key, 7-digit format
- `first_name` — CharField
- `last_name` — CharField
- `email` — EmailField, unique
- `grade` — CharField with choices: `doctor`, `professor`, `assistant`
- `status` — CharField with choices: `active`, `inactive`

**Seed data:**
- Create a fixture file at `apps/esi_db/fixtures/esi_mock_data.json`
- Populate with at least 10 students and 5 professors with realistic data
- Document how to load it: `python manage.py loaddata esi_mock_data`
- Neither model should have create/update/delete exposed through any API endpoint

#### Related Issues
- Depends on: nothing
- Blocks: Issue 4 (Registration API)

---

### Issue 3: [Backend] Profile and Subject Models

**Labels:** `backend`, `models`
**Branch:** `backend/profile-model`

#### Description
Implement the `Profile` model that stores extended user information, and the `Subject` model used to represent ESI courses. The Profile uses a unified structure for both students and professors, with role-specific fields set to nullable for the role that doesn't use them.

#### Technical Notes

**`Subject` model** (in `apps/accounts/models.py` or a new `apps/courses` app):
- `id` — auto
- `name` — CharField (e.g. "Algorithms and Data Structures")
- `code` — CharField, unique (e.g. "ASD101")

**`Profile` model:**
- `user` — OneToOneField → `settings.AUTH_USER_MODEL`, on_delete=CASCADE
- `avatar` — ImageField, nullable (file upload handled later when GCS is set up, use placeholder for now)
- `bio` — TextField, blank=True
- Student-specific fields (null=True, blank=True for professors):
  - `section` — CharField
  - `group` — IntegerField
  - `study_year` — IntegerField
- Professor-specific fields (null=True, blank=True for students):
  - `grade` — CharField with choices matching EsiProfessor
  - `subjects` — ManyToManyField → `Subject`, blank=True

- Use Django signals (`post_save` on User) to automatically create a Profile whenever a new User is created
- Run `python manage.py makemigrations accounts` after implementation

#### Related Issues
- Depends on: Issue 1 (User model)
- Blocks: Issue 4 (Registration API)

---

### Issue 4: [Backend] EmailVerification Model

**Labels:** `backend`, `models`, `auth`
**Branch:** `backend/email-verification-model`

#### Description
Implement the `EmailVerification` model that stores the 6-digit verification codes sent to users during registration. Each code has a 15-minute expiry window and can only be used once.

#### Technical Notes
- Add to `apps/accounts/models.py`
- Fields:
  - `id` — auto
  - `user` — ForeignKey → `settings.AUTH_USER_MODEL`, on_delete=CASCADE
  - `code` — CharField, max_length=6
  - `created_at` — DateTimeField, auto_now_add
  - `expires_at` — DateTimeField (set to created_at + 15 minutes)
  - `is_used` — BooleanField, default False
- Add a model method `is_valid()` that returns True if:
  - `is_used` is False
  - `expires_at` is in the future (`timezone.now() < self.expires_at`)
- Add a model method `generate_code()` as a static method that returns a random 6-digit string using `secrets.randbelow()`— do NOT use `random` module for security-sensitive codes
- Run `python manage.py makemigrations accounts`

#### Related Issues
- Depends on: Issue 1 (User model)
- Blocks: Issue 5 (Registration API)

---

### Issue 5: [Backend] Registration API

**Labels:** `backend`, `api`, `auth`
**Branch:** `backend/registration-api`

#### Description
Implement the three-step registration API endpoints that handle the full registration flow: initiation, email verification, and account completion.

#### Technical Notes

**Endpoints to implement:**

`POST /api/auth/register/initiate/`
- Body: `{ "email": "xxx@esi.dz" }`
- Validate email ends with `@esi.dz` — return 400 if not
- Look up email in `EsiStudent` first, then `EsiProfessor`
- If not found in either: return 404 `{ "error": "Email not found in ESI database" }`
- If found: create an unverified `User` (is_verified=False), copy first_name/last_name/school_id/role from mock DB
- Generate a 6-digit code, save `EmailVerification` record
- Send email with the code using Django's `send_mail`
- Return 200 `{ "message": "Verification code sent" }`
- If user already exists and is verified: return 400 `{ "error": "Account already exists" }`
- If user already exists and is unverified: resend code

`POST /api/auth/register/verify/`
- Body: `{ "email": "xxx@esi.dz", "code": "123456" }`
- Look up the latest unused, unexpired `EmailVerification` for this email
- If invalid or expired: return 400 with appropriate message
- Mark code as `is_used=True`
- Return 200 `{ "message": "Email verified successfully" }`

`POST /api/auth/register/complete/`
- Body: `{ "email": "xxx@esi.dz", "password": "...", "password_confirm": "..." }`
- Check user exists and email is verified
- Validate passwords match and meet Django's password validators
- Set password using `user.set_password()`
- Populate `Profile` with role-specific data from mock DB
- Mark `user.is_verified = True`
- Return JWT access + refresh tokens (same as login response)

**General notes:**
- Use DRF `APIView` or `@api_view` decorator
- Use serializers for all input validation
- Add `djangorestframework-simplejwt` to requirements and configure in settings
- For email sending in development, use Django's console email backend:
  ```python
  # development.py
  EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
  ```

#### Related Issues
- Depends on: Issues 1, 2, 3, 4
- Blocks: Issue 6 (Login API), Frontend Issue 2

---

### Issue 6: [Backend] Login and Token API

**Labels:** `backend`, `api`, `auth`
**Branch:** `backend/login-api`

#### Description
Implement the login endpoint that authenticates a user using their email and password, and returns JWT access and refresh tokens. Also expose the token refresh endpoint.

#### Technical Notes

**Endpoints to implement:**

`POST /api/auth/login/`
- Body: `{ "email": "xxx@esi.dz", "password": "..." }`
- Authenticate using Django's `authenticate()` with email backend
- Check `user.is_verified` — if False return 403 `{ "error": "Email not verified" }`
- On success return:
  ```json
  {
    "access": "...",
    "refresh": "...",
    "user": {
      "email": "...",
      "first_name": "...",
      "last_name": "...",
      "role": "student"
    }
  }
  ```
- On failure return 401 `{ "error": "Invalid credentials" }`

`POST /api/auth/token/refresh/`
- Handled by `djangorestframework-simplejwt` directly, just wire up the URL

**Setup required:**
- Add to `requirements/base.txt`: `djangorestframework-simplejwt`
- Add to `INSTALLED_APPS`: `rest_framework_simplejwt`
- Configure in `settings/base.py`:
  ```python
  REST_FRAMEWORK = {
      'DEFAULT_AUTHENTICATION_CLASSES': (
          'rest_framework_simplejwt.authentication.JWTAuthentication',
      ),
  }
  from datetime import timedelta
  SIMPLE_JWT = {
      'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
      'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
  }
  ```
- Create a custom authentication backend that accepts email instead of username — add to settings: `AUTHENTICATION_BACKENDS = ['apps.accounts.backends.EmailBackend']`

#### Related Issues
- Depends on: Issue 5 (Registration API)
- Blocks: Frontend Issue 3

---

## FRONTEND ISSUES

---

### Issue 7: [Frontend] Auth API Service

**Labels:** `frontend`, `api`, `auth`
**Branch:** `frontend/auth-api-service`

#### Description
Create the TypeScript service layer that handles all API calls related to authentication. This should be built before any UI components so the components have a clean interface to work with.

#### Technical Notes
- Create `frontend/services/auth.ts`
- Define TypeScript interfaces for all request/response shapes:
  ```typescript
  interface InitiateRegistrationRequest { email: string }
  interface VerifyEmailRequest { email: string; code: string }
  interface CompleteRegistrationRequest {
    email: string;
    password: string;
    password_confirm: string;
  }
  interface LoginRequest { email: string; password: string }
  interface AuthTokens { access: string; refresh: string }
  interface AuthUser {
    email: string;
    first_name: string;
    last_name: string;
    role: 'student' | 'professor';
  }
  ```
- Implement functions using the existing `apiClient` from `lib/axios.ts`:
  - `initiateRegistration(data: InitiateRegistrationRequest)`
  - `verifyEmail(data: VerifyEmailRequest)`
  - `completeRegistration(data: CompleteRegistrationRequest)`
  - `login(data: LoginRequest)`
  - `refreshToken(refresh: string)`
- Create `frontend/lib/tokens.ts` for JWT token management:
  - `saveTokens(tokens: AuthTokens)` — stores in memory (no localStorage)
  - `getAccessToken()`
  - `clearTokens()`
- Add axios request interceptor in `lib/axios.ts` to automatically attach the access token to all requests

#### Related Issues
- Depends on: nothing (can be built in parallel with backend)
- Blocks: Issues 8, 9, 10

---

### Issue 8: [Frontend] Registration Page — Step 1 (Email Input)

**Labels:** `frontend`, `ui`, `auth`
**Branch:** `frontend/registration-step1`

#### Description
Implement the first step of the registration flow — a simple page where the user enters their ESI email address. On submission it calls the initiate registration API and transitions to step 2.

#### Technical Notes
- Create `frontend/pages/register.tsx` (or `app/register/page.tsx` depending on your router setup)
- The page manages a `step` state (1, 2, 3) to show the correct step
- Step 1 UI:
  - Email input field
  - Submit button
  - Inline validation: show error if email doesn't end with `@esi.dz` before even calling the API
  - Show API error message if email not found in ESI database
  - Show loading state on submit button while API call is in progress
- On success: transition to step 2, pass email via state

#### Related Issues
- Depends on: Issue 7 (Auth API Service)
- Blocks: Issue 9

---

### Issue 9: [Frontend] Registration Page — Step 2 & 3 (Verify + Complete)

**Labels:** `frontend`, `ui`, `auth`
**Branch:** `frontend/registration-steps2-3`

#### Description
Implement steps 2 and 3 of the registration flow on the same page as step 1.

#### Technical Notes
**Step 2 — Verification code:**
- 6 individual digit input boxes (like OTP inputs) or a single 6-character input
- Resend code button (calls initiate endpoint again) with a 60-second cooldown timer
- Show error if code is invalid or expired
- On success: transition to step 3

**Step 3 — Set password:**
- Password input
- Password confirmation input
- Show password strength indicator
- Validate passwords match before submitting
- On success: store returned JWT tokens via `lib/tokens.ts`, redirect to dashboard

#### Related Issues
- Depends on: Issues 7, 8
- Blocks: nothing

---

### Issue 10: [Frontend] Login Page

**Labels:** `frontend`, `ui`, `auth`
**Branch:** `frontend/login-page`

#### Description
Implement the login page where users authenticate using their ESI email and password.

#### Technical Notes
- Create `frontend/pages/login.tsx`
- Fields: email, password
- Show/hide password toggle
- Show error message for invalid credentials
- Show specific message if account is not verified yet (403 response)
- On success: store JWT tokens, redirect to dashboard based on role:
  - `student` → `/dashboard/student`
  - `professor` → `/dashboard/professor`
- Add a link to the registration page
- Loading state on submit button

#### Related Issues
- Depends on: Issue 7 (Auth API Service)
- Blocks: nothing

---

### Issue 11: [Frontend] Protected Route Middleware

**Labels:** `frontend`, `auth`
**Branch:** `frontend/protected-routes`

#### Description
Implement route protection so unauthenticated users can't access pages that require login, and authenticated users can't access the login/register pages.

#### Technical Notes
- Create `frontend/middleware.ts` using Next.js middleware
- Logic:
  - If user has no access token and tries to access a protected route → redirect to `/login`
  - If user has a token and tries to access `/login` or `/register` → redirect to their dashboard
- Create a `useAuth` hook in `frontend/hooks/useAuth.ts`:
  - Returns `{ user, isLoading, isAuthenticated }`
  - On mount, calls `/api/auth/token/refresh/` to verify token is still valid
  - If refresh fails: clears tokens and redirects to login
- Protected routes for this sprint: `/dashboard/*`

#### Related Issues
- Depends on: Issue 7 (Auth API Service)
- Blocks: nothing (but all dashboard work depends on this)
