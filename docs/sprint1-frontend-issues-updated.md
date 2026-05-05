# Sprint 1 — Frontend Auth Issues (Updated)

---

### Issue 7: [Frontend] Auth API Service

**Labels:** `frontend`, `api`, `auth`
**Branch:** `frontend/auth-api-service`

#### Description
Create the TypeScript service layer that handles all API calls related to authentication. This must be built before any UI components so the components have a clean, typed interface to work with. All raw axios calls related to auth should live here and nowhere else.

#### Technical Notes

**Create `frontend/services/auth.ts`**

Define TypeScript interfaces for all request/response shapes:
```typescript
export interface RegisterRequest {
  email: string;
  password: string;
  password_confirm: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthUser {
  email: string;
  first_name: string;
  last_name: string;
  role: 'student' | 'professor';
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}
```

Implement the following functions using the existing `apiClient` from `lib/axios.ts`:

```typescript
// Validates email, checks ESI DB, creates unverified user, sends code
export const register = (data: RegisterRequest) =>
  apiClient.post('/auth/register/', data);

// Verifies the 6-digit code, returns JWT tokens on success
export const verifyEmail = (data: VerifyEmailRequest) =>
  apiClient.post<LoginResponse>('/auth/verify-email/', data);

// Expires old code and sends a new one
export const resendVerification = (data: ResendVerificationRequest) =>
  apiClient.post('/auth/resend-verification/', data);

// Authenticates user, returns JWT tokens
export const login = (data: LoginRequest) =>
  apiClient.post<LoginResponse>('/auth/login/', data);

// Refreshes access token using refresh token
export const refreshToken = (refresh: string) =>
  apiClient.post<AuthTokens>('/auth/token/refresh/', { refresh });
```

**Create `frontend/lib/tokens.ts`** for JWT token management:
```typescript
// Store tokens in memory only — never localStorage
let accessToken: string | null = null;
let refreshToken: string | null = null;

export const saveTokens = (tokens: AuthTokens) => {
  accessToken = tokens.access;
  refreshToken = tokens.refresh;
};

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => refreshToken;
export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
};
```

**Update `frontend/lib/axios.ts`** to attach token automatically:
```typescript
import { getAccessToken } from './tokens';

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

#### Related Issues
- Depends on: nothing (build in parallel with backend)
- Blocks: Issues 8, 9, 10, 11

---

### Issue 8: [Frontend] Registration Page

**Labels:** `frontend`, `ui`, `auth`
**Branch:** `frontend/registration-page`

#### Description
Implement the registration page where a new user enters their ESI email, password, and password confirmation. On success the user is redirected to the email verification page.

#### Technical Notes
- Create `frontend/pages/register.tsx`
- Fields:
  - Email input
  - Password input with show/hide toggle
  - Password confirmation input with show/hide toggle
  - Submit button

**Client-side validation (before calling API):**
- Email must end with `@esi.dz` — show inline error if not
- Password and confirmation must match — show inline error if not
- All fields required

**API integration:**
- Call `register()` from `services/auth.ts` on submit
- Show loading state on button while request is in progress
- Handle error responses:
  - 400 passwords don't match → show field error
  - 400 invalid domain → show field error
  - 404 email not in ESI database → show message "This email is not registered in the ESI system"
  - 400 account already exists → show message "An account with this email already exists"

**On success:**
- Redirect to `/verify-email?email=xxx@esi.dz`
- Pass email via query param so the verification page knows which email to display

**UI notes:**
- Add a link to `/login` for users who already have an account
- Don't show the actual password in the URL or anywhere visible

#### Related Issues
- Depends on: Issue 7 (Auth API Service)
- Blocks: Issue 9

---

### Issue 9: [Frontend] Email Verification Page

**Labels:** `frontend`, `ui`, `auth`
**Branch:** `frontend/verify-email-page`

#### Description
Implement the email verification page where the user enters the 6-digit code they received by email. This page is reached after successful registration.

#### Technical Notes
- Create `frontend/pages/verify-email.tsx`
- Read the email from the query param: `router.query.email`
- If no email in query params, redirect to `/register`

**UI:**
- Display the email address the code was sent to
- 6-digit code input — either one input field accepting 6 characters, or 6 individual single-digit inputs (OTP style, better UX)
- Submit button
- Resend code button

**Resend logic:**
- On click, call `resendVerification()` from `services/auth.ts`
- After clicking resend, start a 60-second countdown timer
- Disable the resend button during countdown, show "Resend in 45s..."
- After countdown ends, re-enable the button
- Show success message "A new code has been sent" after resend

**API integration:**
- Call `verifyEmail()` from `services/auth.ts` on submit
- Handle error responses:
  - 400 invalid code → "Invalid code, please try again"
  - 400 expired code → "This code has expired, please request a new one"
- Show loading state on submit button

**On success:**
- Save returned JWT tokens via `saveTokens()` from `lib/tokens.ts`
- Redirect based on role:
  - `student` → `/dashboard/student`
  - `professor` → `/dashboard/professor`

#### Related Issues
- Depends on: Issues 7, 8
- Blocks: nothing

---

### Issue 10: [Frontend] Login Page

**Labels:** `frontend`, `ui`, `auth`
**Branch:** `frontend/login-page`

#### Description
Implement the login page where existing users authenticate using their ESI email and password.

#### Technical Notes
- Create `frontend/pages/login.tsx`
- Fields:
  - Email input
  - Password input with show/hide toggle
  - Submit button

**Client-side validation:**
- Both fields required
- Email must end with `@esi.dz`

**API integration:**
- Call `login()` from `services/auth.ts` on submit
- Handle error responses:
  - 401 invalid credentials → "Invalid email or password"
  - 403 unverified account → "Please verify your email first" + show link to `/verify-email?email=...`
- Show loading state on submit button

**On success:**
- Save returned JWT tokens via `saveTokens()` from `lib/tokens.ts`
- Redirect based on role:
  - `student` → `/dashboard/student`
  - `professor` → `/dashboard/professor`

**UI notes:**
- Add link to `/register` for new users
- Add "Forgot password?" placeholder link (feature not implemented yet, just the UI element)

#### Related Issues
- Depends on: Issue 7 (Auth API Service)
- Blocks: nothing

---

### Issue 11: [Frontend] Protected Route Middleware

**Labels:** `frontend`, `auth`
**Branch:** `frontend/protected-routes`

#### Description
Implement route protection so unauthenticated users can't access protected pages, and authenticated users can't access the login or register pages.

#### Technical Notes

**Create `frontend/hooks/useAuth.ts`:**
```typescript
export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getRefreshToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    // attempt to refresh access token to verify session is still valid
    refreshToken(token)
      .then(res => {
        saveTokens(res.data);
        // optionally fetch user profile here
        setIsLoading(false);
      })
      .catch(() => {
        clearTokens();
        setIsLoading(false);
      });
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!getAccessToken(),
  };
};
```

**Create `frontend/components/ProtectedRoute.tsx`:**
```typescript
export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) {
    router.replace('/login');
    return null;
  }
  return <>{children}</>;
};
```

**Usage in pages:**
```typescript
// pages/dashboard/student.tsx
export default function StudentDashboard() {
  return (
    <ProtectedRoute>
      <div>Student Dashboard</div>
    </ProtectedRoute>
  );
}
```

**Routes to protect for this sprint:** `/dashboard/student`, `/dashboard/professor`

**Routes to redirect away from if already authenticated:** `/login`, `/register`, `/verify-email`

#### Related Issues
- Depends on: Issue 7 (Auth API Service)
- Blocks: all future dashboard work
