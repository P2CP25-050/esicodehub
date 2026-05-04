# Deployment Sprint — Final Sprint Before Submission

**Goal:** Fully deployed production system at `esicodehub.tech`, zero duplicate API calls,
forum and plagiarism frontend complete, partial style refresh done.
**Duration:** 7 days
**End state:** Working product requiring only documentation to submit.

---

## Team Assignment Overview

| Track | Who | Issues |
|-------|-----|--------|
| DevOps | Dhia | D1 → D2 → D3 → D4 → D5 → D6 |
| Backend | Backend Dev 1 | B1 → B2 |
| Backend | Backend Dev 2 | B3 → B4 |
| Frontend | Frontend Dev 1 | F1 → F2 (unblocks F3, F4, F5) |
| Frontend | Frontend Dev 2 | F3 (after F1) → F5 |
| Frontend | Frontend Dev 3 | F4 (after F1) → F6 |

**Critical path:** F1 must merge before F2, F3, F4, F5, F6 can start.
D1 must complete before D2 and D3 can be finalized.
B1 must merge before the production deployment is live (email is needed for real student registration).

---

## DEVOPS ISSUES

---

### Issue D1: [DevOps] Domain DNS Configuration

**Labels:** `devops`, `infrastructure`
**Branch:** `devops/dns-setup`
**Assigned to:** Dhia
**Estimated time:** 1 hour

#### Description
Configure DNS records for `esicodehub.tech` to point to our Vercel frontend
and Cloud Run backend. Also set up the email DNS records required by Gmail
to prevent verification emails from landing in spam.

#### Technical Notes

**In your name.com DNS panel, create these records:**

```
# Frontend — Vercel will give you these exact values during setup (D3)
# Add them after D3 is done. Placeholder shown here.
Type: A       Name: @        Value: 76.76.21.21   (Vercel IP, confirm during D3)
Type: CNAME   Name: www      Value: cname.vercel-dns.com

# Backend API subdomain — Cloud Run will give you the IP/URL during setup (D2)
Type: CNAME   Name: api      Value: <cloud-run-url>.run.app

# Gmail SPF record — prevents verification emails going to spam
Type: TXT     Name: @        Value: v=spf1 include:_spf.google.com ~all

# DMARC record — improves email deliverability
Type: TXT     Name: _dmarc   Value: v=DMARC1; p=none; rua=mailto:noreply.esicodehub@gmail.com
```

**Notes:**
- DNS propagation takes 5–30 minutes for name.com, sometimes up to 2 hours.
- Verify propagation using: `nslookup api.esicodehub.tech`
- Do not add the Vercel A record until D3 is complete — Vercel gives you
  the correct values during domain setup in their dashboard.
- The SPF and DMARC records are critical for Gmail SMTP. Without them,
  verification code emails will be marked as spam by ESI student inboxes.

#### Related Issues
- Blocks: D2 (needs api subdomain ready), D3 (needs root domain ready)

---

### Issue D2: [DevOps] Cloud Run Backend Deployment

**Labels:** `devops`, `infrastructure`, `backend`
**Branch:** `devops/cloud-run-deployment`
**Assigned to:** Dhia
**Estimated time:** 3–4 hours

#### Description
Deploy the Django backend as a containerized service on Google Cloud Run.
Configure it for production: HTTPS only, environment variables from Secret Manager,
and minimum 1 instance to avoid cold starts during the live test.

#### Technical Notes

**Step 1 — Create production Dockerfile at `backend/Dockerfile.prod`:**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for psycopg2 and Pillow
RUN apt-get update && apt-get install -y \
    libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements/ requirements/
RUN pip install --no-cache-dir -r requirements/production.txt

COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput \
    --settings=config.settings.production || true

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "2", \
     "--threads", "4", \
     "--timeout", "120", \
     "--log-level", "info"]
```

**Step 2 — Create `config/settings/production.py`:**

```python
from .base import *
import os

DEBUG = False

ALLOWED_HOSTS = [
    'api.esicodehub.tech',
    '*.run.app',   # Cloud Run internal URL
]

# Database — Cloud SQL via Unix socket
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('POSTGRES_DB'),
        'USER': os.getenv('POSTGRES_USER'),
        'PASSWORD': os.getenv('POSTGRES_PASSWORD'),
        'HOST': os.getenv('DATABASE_HOST'),   # /cloudsql/<project>:<region>:<instance>
        'PORT': '5432',
    }
}

# CORS — required for cookie-based auth cross-origin
CORS_ALLOWED_ORIGINS = [
    'https://esicodehub.tech',
    'https://www.esicodehub.tech',
]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [
    'https://esicodehub.tech',
    'https://www.esicodehub.tech',
]

# Cookie security
AUTH_COOKIE_SECURE = True
AUTH_COOKIE_SAMESITE = 'None'  # Required for cross-origin cookies (api. vs root domain)
SESSION_COOKIE_SECURE = True

# Email — Gmail SMTP
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_APP_PASSWORD')
DEFAULT_FROM_EMAIL = f'ESIcodeHub <{os.getenv("EMAIL_HOST_USER")}>'
SERVER_EMAIL = DEFAULT_FROM_EMAIL

# GCS — already configured in base.py, just ensure bucket is set
GS_BUCKET_NAME = os.getenv('GS_BUCKET_NAME')

# Security headers
SECURE_SSL_REDIRECT = False    # Cloud Run handles HTTPS termination
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

**Step 3 — Store secrets in Google Secret Manager:**

```bash
# Run these in Cloud Shell or with gcloud CLI installed
gcloud secrets create DJANGO_SECRET_KEY --data-file=- <<< "your-secret-key"
gcloud secrets create EMAIL_APP_PASSWORD --data-file=- <<< "your-app-password"
gcloud secrets create POSTGRES_PASSWORD --data-file=- <<< "your-db-password"
gcloud secrets create MOSS_USER_ID --data-file=- <<< "your-moss-id"
gcloud secrets create GEMINI_API_KEY --data-file=- <<< "your-gemini-key"
```

**Step 4 — Build and push Docker image:**

```bash
# Enable required APIs first
gcloud services enable run.googleapis.com containerregistry.googleapis.com

# Build and push
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/esicodehub-backend \
  --dockerfile backend/Dockerfile.prod ./backend
```

**Step 5 — Deploy to Cloud Run:**

```bash
gcloud run deploy esicodehub-backend \
  --image gcr.io/YOUR_PROJECT_ID/esicodehub-backend \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars DJANGO_SETTINGS_MODULE=config.settings.production \
  --set-env-vars DATABASE_HOST=/cloudsql/YOUR_PROJECT:europe-west1:esicodehub-db \
  --set-secrets "DJANGO_SECRET_KEY=DJANGO_SECRET_KEY:latest" \
  --set-secrets "POSTGRES_PASSWORD=POSTGRES_PASSWORD:latest" \
  --set-secrets "EMAIL_APP_PASSWORD=EMAIL_APP_PASSWORD:latest" \
  --set-secrets "MOSS_USER_ID=MOSS_USER_ID:latest" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --add-cloudsql-instances YOUR_PROJECT:europe-west1:esicodehub-db
```

**Step 6 — Run migrations on first deploy:**

```bash
gcloud run jobs create run-migrations \
  --image gcr.io/YOUR_PROJECT_ID/esicodehub-backend \
  --region europe-west1 \
  --set-env-vars DJANGO_SETTINGS_MODULE=config.settings.production \
  --command "python" \
  --args "manage.py,migrate" \
  --add-cloudsql-instances YOUR_PROJECT:europe-west1:esicodehub-db

gcloud run jobs execute run-migrations --region europe-west1
```

**Step 7 — Map custom domain:**
In Cloud Run console → Manage custom domains → Add `api.esicodehub.tech`.
Cloud Run will give you a CNAME value — add it to DNS as specified in D1.

#### Related Issues
- Depends on: D1 (for custom domain mapping)
- Blocks: D5 (Celery worker uses the same image)

---

### Issue D3: [DevOps] Vercel Frontend Deployment

**Labels:** `devops`, `infrastructure`, `frontend`
**Branch:** `devops/vercel-deployment`
**Assigned to:** Dhia
**Estimated time:** 1 hour

#### Description
Deploy the Next.js frontend to Vercel and connect it to `esicodehub.tech`.
Configure the production API URL environment variable so all API calls go to
the Cloud Run backend.

#### Technical Notes

**Step 1 — Connect GitHub repo to Vercel:**
- Go to vercel.com → New Project → Import from GitHub
- Select the `esicodehub` monorepo
- Set **Root Directory** to `frontend`
- Framework: Next.js (auto-detected)

**Step 2 — Add environment variables in Vercel dashboard:**

```
NEXT_PUBLIC_API_URL = https://api.esicodehub.tech/api
```

Do not hardcode this anywhere in the code. Vercel injects it at build time.

**Step 3 — Add custom domain:**
In Vercel dashboard → Settings → Domains → Add `esicodehub.tech` and `www.esicodehub.tech`.
Vercel gives you the A record and CNAME values — add them to DNS as specified in D1.

**Step 4 — Configure `next.config.js` for production:**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['storage.googleapis.com'],  // for GCS avatar images
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
}
module.exports = nextConfig;
```

**Step 5 — Verify deployment:**
- `https://esicodehub.tech` loads the landing page
- `https://api.esicodehub.tech/api/subjects/` returns JSON (confirms backend is live)
- Login works end-to-end (confirms cookies are sent cross-origin correctly)

#### Related Issues
- Depends on: D1 (domain), D2 (backend must be live before frontend can login)
- Blocks: nothing — but D5 should be done before announcing the platform is live

---

### Issue D4: [DevOps] Cloud SQL Setup + Database Migration

**Labels:** `devops`, `infrastructure`, `database`
**Branch:** `devops/cloud-sql-setup`
**Assigned to:** Dhia
**Estimated time:** 2 hours

#### Description
Create a Cloud SQL PostgreSQL 14 instance, migrate the production schema,
and load the ESI mock DB fixture. This replaces local Docker PostgreSQL
for production.

#### Technical Notes

**Step 1 — Create the Cloud SQL instance:**

```bash
gcloud sql instances create esicodehub-db \
  --database-version POSTGRES_14 \
  --tier db-g1-small \
  --region europe-west1 \
  --storage-type SSD \
  --storage-size 10GB \
  --storage-auto-increase \
  --backup-start-time 02:00 \
  --availability-type zonal
```

**Step 2 — Create the database and user:**

```bash
gcloud sql databases create esicodehub --instance esicodehub-db
gcloud sql users create esicodehub_user \
  --instance esicodehub-db \
  --password YOUR_SECURE_PASSWORD
```

**Step 3 — Run migrations (uses the Cloud Run job created in D2):**

```bash
gcloud run jobs execute run-migrations --region europe-west1
```

**Step 4 — Load the ESI mock DB fixture:**
Once B3 is merged and the fixture file is in the repo:

```bash
gcloud run jobs create load-fixtures \
  --image gcr.io/YOUR_PROJECT_ID/esicodehub-backend \
  --region europe-west1 \
  --set-env-vars DJANGO_SETTINGS_MODULE=config.settings.production \
  --command "python" \
  --args "manage.py,loaddata,esi_mock_data" \
  --add-cloudsql-instances YOUR_PROJECT:europe-west1:esicodehub-db

gcloud run jobs execute load-fixtures --region europe-west1
```

**Step 5 — Create the admin superuser:**

```bash
# Connect via Cloud Run exec and run createsuperuser
gcloud run jobs create create-superuser \
  --image gcr.io/YOUR_PROJECT_ID/esicodehub-backend \
  --region europe-west1 \
  --set-env-vars DJANGO_SETTINGS_MODULE=config.settings.production \
  --set-env-vars DJANGO_SUPERUSER_EMAIL=admin@esicodehub.tech \
  --set-env-vars DJANGO_SUPERUSER_PASSWORD=CHANGE_ME_NOW \
  --command "python" \
  --args "manage.py,createsuperuser,--noinput" \
  --add-cloudsql-instances YOUR_PROJECT:europe-west1:esicodehub-db

gcloud run jobs execute create-superuser --region europe-west1
```

**Change the superuser password immediately after** via the Django admin panel
at `https://api.esicodehub.tech/admin/`.

#### Related Issues
- Depends on: D2 (Cloud Run image must exist)
- Depends on: B3 (ESI fixture must be merged)
- Blocks: D6 (Celery needs DB access too)

---

### Issue D5: [DevOps] Celery Worker on Cloud Run Jobs

**Labels:** `devops`, `infrastructure`, `celery`
**Branch:** `devops/celery-worker-deployment`
**Assigned to:** Dhia
**Estimated time:** 2 hours

#### Description
Deploy the Celery worker as a long-running Cloud Run Job. Uses the same
Docker image as the backend but with a different startup command.
Also sets up Upstash Redis as the broker since local Redis doesn't
exist in Cloud Run.

#### Technical Notes

**Step 1 — Create a free Redis instance on Upstash:**
- Go to upstash.com → Create Database
- Name: `esicodehub-redis`
- Region: `eu-west-1` (closest to Algeria)
- Type: Regional (free tier)
- Copy the `REDIS_URL` (it looks like `rediss://default:xxx@xxx.upstash.io:6380`)
- Store it in Secret Manager: `gcloud secrets create REDIS_URL --data-file=- <<< "your-redis-url"`

**Step 2 — Deploy Celery worker as a Cloud Run service** (not a Job —
we need it running continuously, not just on-demand):

```bash
gcloud run deploy esicodehub-celery \
  --image gcr.io/YOUR_PROJECT_ID/esicodehub-backend \
  --platform managed \
  --region europe-west1 \
  --no-allow-unauthenticated \
  --min-instances 1 \
  --max-instances 2 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --concurrency 1 \
  --set-env-vars DJANGO_SETTINGS_MODULE=config.settings.production \
  --set-env-vars "CELERY_WORKER=true" \
  --set-secrets "REDIS_URL=REDIS_URL:latest" \
  --set-secrets "POSTGRES_PASSWORD=POSTGRES_PASSWORD:latest" \
  --set-secrets "DJANGO_SECRET_KEY=DJANGO_SECRET_KEY:latest" \
  --set-secrets "MOSS_USER_ID=MOSS_USER_ID:latest" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --add-cloudsql-instances YOUR_PROJECT:europe-west1:esicodehub-db \
  --command "celery" \
  --args "-A,config,worker,--loglevel=info,--concurrency=2"
```

**Note on memory:** Celery workers that run MOSS need more memory because
they download files from GCS into a temp directory. 2Gi is the right size
for assignments with 50+ student submissions.

**Step 3 — Update `config/settings/production.py` to use Upstash Redis:**

```python
CELERY_BROKER_URL = os.getenv('REDIS_URL')
CELERY_BROKER_USE_SSL = True   # Upstash requires SSL
CELERY_REDIS_BACKEND_USE_SSL = True
```

**Step 4 — Also update the main backend deployment to pass REDIS_URL:**

```bash
gcloud run services update esicodehub-backend \
  --region europe-west1 \
  --set-secrets "REDIS_URL=REDIS_URL:latest"
```

**Verify Celery is working:**
Trigger a plagiarism check from the professor's UI after deployment
and watch the report status update from `pending` → `running` → `complete`.

#### Related Issues
- Depends on: D2, D4

---

### Issue D6: [DevOps] GitHub Actions CI/CD Pipeline

**Labels:** `devops`, `ci-cd`
**Branch:** `devops/github-actions`
**Assigned to:** Dhia
**Estimated time:** 1.5 hours

#### Description
Set up automatic deployment on every push to `main`. Backend deploys to
Cloud Run, frontend deploys via Vercel's GitHub integration (already
handled by Vercel automatically once D3 is done). This issue covers
the backend pipeline only.

#### Technical Notes

**Create `.github/workflows/deploy-backend.yml`:**

```yaml
name: Deploy Backend to Cloud Run

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - '.github/workflows/deploy-backend.yml'

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.12'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements/base.txt -r requirements/development.txt
      - name: Run tests
        env:
          DJANGO_SETTINGS_MODULE: config.settings.development
          DATABASE_HOST: localhost
          POSTGRES_DB: testdb
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: testpass
          SECRET_KEY: test-secret-key-for-ci
        run: |
          cd backend
          python manage.py test --verbosity=2

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Build and push Docker image
        run: |
          gcloud builds submit \
            --tag gcr.io/${{ secrets.GCP_PROJECT_ID }}/esicodehub-backend \
            --dockerfile backend/Dockerfile.prod \
            ./backend

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy esicodehub-backend \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/esicodehub-backend \
            --region europe-west1 \
            --platform managed

      - name: Deploy Celery worker
        run: |
          gcloud run deploy esicodehub-celery \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/esicodehub-backend \
            --region europe-west1 \
            --platform managed
```

**Required GitHub Secrets** (add in repo Settings → Secrets → Actions):
- `GCP_SA_KEY` — JSON key of a service account with Cloud Run Developer + Storage Admin roles
- `GCP_PROJECT_ID` — your GCP project ID

**Create the service account:**
```bash
gcloud iam service-accounts create github-actions \
  --display-name "GitHub Actions Deploy"

gcloud projects add-iam-policy-binding YOUR_PROJECT \
  --member "serviceAccount:github-actions@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role "roles/run.developer"

gcloud projects add-iam-policy-binding YOUR_PROJECT \
  --member "serviceAccount:github-actions@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role "roles/storage.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT \
  --member "serviceAccount:github-actions@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role "roles/secretmanager.secretAccessor"

gcloud iam service-accounts keys create github-sa-key.json \
  --iam-account github-actions@YOUR_PROJECT.iam.gserviceaccount.com
```
Copy the contents of `github-sa-key.json` into the `GCP_SA_KEY` GitHub secret.
Delete `github-sa-key.json` from your machine immediately after.

#### Related Issues
- Depends on: D2

---

## BACKEND ISSUES

---

### Issue B1: [Backend] Gmail SMTP + Celery Email Tasks

**Labels:** `backend`, `email`, `celery`
**Branch:** `backend/email-setup`
**Assigned to:** Backend Dev 1
**Estimated time:** 2 hours

#### Description
Configure Gmail SMTP for production and move all email sending to async
Celery tasks so email latency never blocks API responses. This affects
registration verification codes, password reset emails, and future
notification emails.

#### Technical Notes

**Step 1 — Gmail App Password setup (do this before writing any code):**
1. Go to the `noreply.esicodehub@gmail.com` account
2. Enable 2-Step Verification in Google Account → Security
3. Search "App Passwords" → Create → Name: "ESIcodeHub SMTP"
4. Copy the 16-character password and add it to `backend/.env` as `EMAIL_APP_PASSWORD`
5. Also add `EMAIL_HOST_USER=noreply.esicodehub@gmail.com` to `.env`

**Step 2 — Create `apps/accounts/tasks.py`** (if it doesn't exist yet,
or add to it if Celery tasks already live there):

```python
from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_verification_email(self, user_email: str, code: str):
    """Send email verification code. Retries up to 3 times on SMTP failure."""
    try:
        send_mail(
            subject='Your ESIcodeHub verification code',
            message=(
                f'Your verification code is: {code}\n\n'
                f'This code expires in 15 minutes.\n\n'
                f'If you did not request this, ignore this email.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user_email],
            fail_silently=False,
        )
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_password_reset_email(self, user_email: str, reset_url: str):
    """Send password reset link."""
    try:
        send_mail(
            subject='Reset your ESIcodeHub password',
            message=(
                f'Click the link below to reset your password:\n\n'
                f'{reset_url}\n\n'
                f'This link expires in 1 hour.\n\n'
                f'If you did not request this, ignore this email.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user_email],
            fail_silently=False,
        )
    except Exception as exc:
        raise self.retry(exc=exc)
```

**Step 3 — Update all places that call `send_mail()` directly** to use
`.delay()` instead:

```python
# Before (synchronous — blocks the request for 1–2 seconds)
send_mail(subject=..., message=..., ...)

# After (async — returns immediately, email sent in background)
send_verification_email.delay(user.email, code)
send_password_reset_email.delay(user.email, reset_url)
```

**Step 4 — Add development email backend override** so emails print to
console locally and don't require SMTP during development:

```python
# config/settings/development.py
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
```

```python
# config/settings/production.py  (already in D2, confirm it's here)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_APP_PASSWORD')
DEFAULT_FROM_EMAIL = f'ESIcodeHub <{os.getenv("EMAIL_HOST_USER")}>'
```

**Step 5 — Test locally with the console backend:**
Register a new account and confirm the verification code prints to the
Django terminal (not the Celery terminal, because `EMAIL_BACKEND` in
development is still the console backend — Celery tasks pick up the
Django settings, so the console output appears in the Celery worker logs).

#### Related Issues
- Blocks: B2 (password reset needs email)
- Blocks: D2 (production deployment needs email configured)

---

### Issue B2: [Backend] Forgot Password Endpoints

**Labels:** `backend`, `api`, `auth`
**Branch:** `backend/forgot-password`
**Assigned to:** Backend Dev 1
**Estimated time:** 3 hours

#### Description
Implement the two-step forgot password flow: request a reset link via email,
then confirm the new password using the token in the link. Uses a secure
token model (not the same as email verification codes).

#### Technical Notes

**Step 1 — Add `PasswordResetToken` model to `apps/accounts/models.py`:**

```python
import secrets
from datetime import timedelta
from django.utils import timezone

class PasswordResetToken(models.Model):
    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens'
    )
    token      = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used    = models.BooleanField(default=False)

    class Meta:
        db_table = 'password_reset_tokens'

    def save(self, *args, **kwargs):
        if not self.pk:
            self.expires_at = timezone.now() + timedelta(hours=1)
        super().save(*args, **kwargs)

    def is_valid(self) -> bool:
        return not self.is_used and timezone.now() < self.expires_at

    @staticmethod
    def generate_token() -> str:
        return secrets.token_urlsafe(48)  # 64 chars when base64-encoded
```

Run `python manage.py makemigrations accounts`.

**Step 2 — Implement the two endpoints in `apps/accounts/views.py`:**

`POST /api/auth/forgot-password/`
```python
class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'Email is required.'}, status=400)

        # Always return 200 even if email not found — prevents user enumeration
        try:
            user = User.objects.get(email=email, is_verified=True)
        except User.DoesNotExist:
            return Response({'message': 'If this email exists, a reset link has been sent.'})

        # Invalidate any existing unused tokens for this user
        PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True)

        token = PasswordResetToken.generate_token()
        PasswordResetToken.objects.create(user=user, token=token)

        reset_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token={token}"
        send_password_reset_email.delay(user.email, reset_url)

        return Response({'message': 'If this email exists, a reset link has been sent.'})
```

`POST /api/auth/reset-password/`
```python
class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token_str    = request.data.get('token', '')
        password     = request.data.get('password', '')
        password2    = request.data.get('password_confirm', '')

        if not all([token_str, password, password2]):
            return Response({'error': 'All fields are required.'}, status=400)

        if password != password2:
            return Response({'error': 'Passwords do not match.'}, status=400)

        try:
            token = PasswordResetToken.objects.select_related('user').get(token=token_str)
        except PasswordResetToken.DoesNotExist:
            return Response({'error': 'Invalid or expired reset link.'}, status=400)

        if not token.is_valid():
            return Response({'error': 'This reset link has expired. Please request a new one.'}, status=400)

        user = token.user
        user.set_password(password)
        user.save(update_fields=['password'])

        token.is_used = True
        token.save(update_fields=['is_used'])

        return Response({'message': 'Password reset successfully. You can now log in.'})
```

**Step 3 — Add to `apps/accounts/urls.py`:**

```python
path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
```

**Step 4 — Add `FRONTEND_URL` to `.env`:**

```
# development
FRONTEND_URL=http://localhost:3000

# production (add to Cloud Run env vars in D2)
FRONTEND_URL=https://esicodehub.tech
```

#### Related Issues
- Depends on: B1 (email tasks must exist)
- Blocks: F7 (forgot password page)

---

### Issue B3: [Backend] Full ESI Mock DB Fixture

**Labels:** `backend`, `models`, `data`
**Branch:** `backend/esi-mock-db-full`
**Assigned to:** Backend Dev 2
**Estimated time:** already done — just needs review and merge

#### Description
Merge the complete ESI mock database fixture covering all years (1CP through 3CS)
converted from the Excel sheets. This is a hard blocker for the live test —
without it, real students cannot register.

#### Technical Notes

**Verify before merging:**

1. The fixture file is at `apps/esi_db/fixtures/esi_mock_data.json`
2. Every student record has all required fields: `school_id` (format `yy/xxxx`),
   `first_name`, `last_name`, `email` (must end in `@esi.dz`), `section`, `group`,
   `study_year` (integer 1–5), `status`.
3. Every professor record has: `school_id` (7-digit), `first_name`, `last_name`,
   `email`, `grade`, `status`.
4. Run `python manage.py loaddata esi_mock_data` locally and confirm it loads
   without errors.
5. Confirm the registration flow works with a real student email from the fixture:
   `POST /api/auth/register/` with a real `@esi.dz` email that exists in the fixture
   should return 200, not 404.

**Year → `study_year` mapping for the fixture:**
```
1CP → study_year: 1
2CP → study_year: 2
1CS → study_year: 3
2CS → study_year: 4
3CS → study_year: 5
```

**After merge, ping Dhia** to run D4 Step 4 (load fixture into production Cloud SQL).

#### Related Issues
- Blocks: D4 (fixture load into Cloud SQL)

---

### Issue B4: [Backend] Fix Forum Serializer N+1 Query

**Labels:** `backend`, `performance`, `forum`
**Branch:** `backend/forum-n1-fix`
**Assigned to:** Backend Dev 2
**Estimated time:** 2 hours

#### Description
The `get_user_vote` method in `AnswerSerializer` fires one database query
per answer in the list — if a question has 20 answers, that's 20 extra queries.
Fix using a prefetch with annotations so all vote data is loaded in a single query.

#### Technical Notes

**The problem** — current code in `apps/forum/serializers.py`:

```python
# This fires one query per answer — do NOT keep this
def get_user_vote(self, obj):
    request = self.context.get('request')
    if not request or not request.user.is_authenticated:
        return None
    vote = Vote.objects.filter(
        user=request.user,
        content_type=ContentType.objects.get_for_model(obj),
        object_id=obj.pk
    ).first()
    return vote.value if vote else None
```

**The fix — annotate at the view level before serializing:**

```python
# apps/forum/views.py — in QuestionDetailView.get()

from django.contrib.contenttypes.models import ContentType
from django.db.models import OuterRef, Subquery, IntegerField

def get_annotated_answers(question, user):
    """
    Returns answers queryset annotated with:
    - vote_score: sum of all votes
    - user_vote_value: current user's vote value (or None)
    Both computed in the database — no per-answer queries.
    """
    answer_ct = ContentType.objects.get_for_model(Answer)

    # Subquery: the current user's vote value on each answer
    user_vote_subquery = Vote.objects.filter(
        content_type=answer_ct,
        object_id=OuterRef('pk'),
        user=user,
    ).values('value')[:1]

    # Subquery: total vote score for each answer
    vote_score_subquery = Vote.objects.filter(
        content_type=answer_ct,
        object_id=OuterRef('pk'),
    ).annotate(
        total=models.Sum('value')
    ).values('total')[:1]

    return (
        Answer.objects.filter(question=question, parent=None)
        .select_related('author')
        .prefetch_related('replies__author')  # one query for all replies
        .annotate(
            user_vote_value=Subquery(user_vote_subquery, output_field=IntegerField()),
            vote_score_db=Subquery(vote_score_subquery, output_field=IntegerField()),
        )
        .order_by('-is_accepted', 'created_at')
    )
```

Then update `AnswerSerializer` to read from annotations instead of querying:

```python
def get_user_vote(self, obj):
    # Read from annotation set by the view — no extra query
    return getattr(obj, 'user_vote_value', None)

def get_vote_score(self, obj):
    score = getattr(obj, 'vote_score_db', None)
    return score if score is not None else 0
```

**Measure the improvement** with Django Debug Toolbar locally:
- Before fix: opening a question detail with 10 answers should show 10+ vote queries
- After fix: same page should show 1 query for answers + 2 subqueries total

#### Related Issues
- Blocks: nothing — but should merge before the live test to reduce DB load

---

## FRONTEND ISSUES

---

### Issue F1: [Frontend] Auth Context Migration (Stops Duplicate API Calls)

**Labels:** `frontend`, `performance`, `auth`
**Branch:** `frontend/auth-context`
**Assigned to:** Frontend Dev 1
**Estimated time:** 2–3 hours
**Priority: CRITICAL — merge this before any other frontend issue starts**

#### Description
Replace the `hooks/useAuth.ts` hook (which re-runs auth initialization in every
component that calls it) with a React Context that initializes once at the app
level and shares state across all components. This stops the 3–7 duplicate
`/auth/refresh` and `/auth/me` calls visible in the network tab.

#### Technical Notes

**Step 1 — Create `frontend/context/AuthContext.tsx`:**

```typescript
import {
  createContext, useContext, useEffect,
  useState, ReactNode, useCallback
} from 'react';
import { useRouter } from 'next/router';
import { refreshToken, getMe, logout as logoutApi } from '@/services/auth';
import { saveTokens, clearTokens } from '@/lib/tokens';

export interface AuthUser {
  email: string;
  first_name: string;
  last_name: string;
  role: 'student' | 'professor';
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Pages where auth should NOT be checked (avoids 2 API calls on public pages)
const PUBLIC_PATHS = ['/', '/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some(p => router.pathname === p || router.pathname.startsWith(p + '/'));
    if (isPublic) {
      setIsLoading(false);
      return;
    }

    // HttpOnly cookie is sent automatically — no token argument needed
    refreshToken()
      .then(tokens => {
        saveTokens(tokens);    // saves access token in memory for Axios interceptor
        return getMe();
      })
      .then(userData => setUser(userData))
      .catch(() => {
        clearTokens();
        // Don't redirect here — ProtectedRoute handles the redirect
      })
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Empty array — MUST be empty. This runs once on app mount only.

  const logout = useCallback(async () => {
    try {
      await logoutApi();  // calls backend to clear the HttpOnly cookie
    } finally {
      clearTokens();
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      setUser,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider — wrap your app in _app.tsx');
  return ctx;
}
```

**Step 2 — Update `pages/_app.tsx`:**

```typescript
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { AuthProvider } from '@/context/AuthContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
```

**Step 3 — Update `lib/axios.ts` to add `withCredentials: true`:**

```typescript
import axios from 'axios';
import { getAccessToken, clearTokens } from './tokens';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  withCredentials: true,   // REQUIRED — sends the HttpOnly refresh cookie cross-origin
});

apiClient.interceptors.request.use(config => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — on 401, the refresh will use the HttpOnly cookie automatically
apiClient.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/auth/token/refresh/`,
          {},
          { withCredentials: true }
        );
        saveTokens(data);
        original.headers.Authorization = `Bearer ${data.access}`;
        return apiClient(original);
      } catch {
        clearTokens();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

**Step 4 — Delete `hooks/useAuth.ts`.**
Update all imports across the entire project:
```
from '@/hooks/useAuth'  →  from '@/context/AuthContext'
```
Use your editor's global find-and-replace to do this in one step.

**Step 5 — Verify the fix:**
Open the browser Network tab, navigate to `/home`.
You should see exactly: 1× `POST /auth/token/refresh/` and 1× `GET /auth/me/`.
Not 3, not 6. Exactly 2. If you see more, a component is still calling `useAuth`
in a way that triggers its own initialization — find it and remove the duplicate.

#### Related Issues
- Blocks: F2, F3, F4, F5, F6 (all must base on this new auth pattern)

---

### Issue F2: [Frontend] Forum List Page

**Labels:** `frontend`, `ui`, `forum`
**Branch:** `frontend/forum-list-page`
**Assigned to:** Frontend Dev 1
**Estimated time:** 4–5 hours

#### Description
Implement `pages/forum/index.tsx`. Reddit-style question feed.
Refer to Issue Q5 in `sprint5-issues-updated.md` for the full specification.
Key requirements: vote buttons on cards, tag filter sidebar, sort tabs
(Newest / Top / Unanswered), debounced search, pagination with "Load more".

#### Technical Notes

**Import from the correct paths after F1:**
```typescript
import { useAuth } from '@/context/AuthContext';  // NOT from hooks/useAuth
import { listQuestions, voteQuestion } from '@/services/forum';
import type { QuestionListItem } from '@/services/forum';
```

**Debounce implementation** (no library needed):
```typescript
const [searchInput, setSearchInput] = useState('');
const [search, setSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => setSearch(searchInput), 300);
  return () => clearTimeout(timer);
}, [searchInput]);
```

**Optimistic vote update pattern:**
```typescript
const handleVote = async (questionId: number, value: 1 | -1) => {
  // Update UI immediately before API call
  setQuestions(prev => prev.map(q =>
    q.id === questionId
      ? { ...q, vote_score: q.vote_score + value }
      : q
  ));
  try {
    const result = await voteQuestion(questionId, value);
    // Replace with server's authoritative score
    setQuestions(prev => prev.map(q =>
      q.id === questionId ? { ...q, vote_score: result.vote_score } : q
    ));
  } catch {
    // Revert on failure
    setQuestions(prev => prev.map(q =>
      q.id === questionId
        ? { ...q, vote_score: q.vote_score - value }
        : q
    ));
  }
};
```

**Shuffle first-page results** when `ordering === 'newest'` only:
```typescript
const displayQuestions = ordering === 'newest' && page === 1
  ? [...questions].sort(() => Math.random() - 0.5)
  : questions;
```

#### Related Issues
- Depends on: F1

---

### Issue F3: [Frontend] Forum Question Pages (Ask + Detail)

**Labels:** `frontend`, `ui`, `forum`
**Branch:** `frontend/forum-question-pages`
**Assigned to:** Frontend Dev 2
**Estimated time:** 6–8 hours

#### Description
Implement two pages: `pages/forum/new.tsx` (ask a question) and
`pages/forum/[id].tsx` (question detail with full answer thread).
Refer to Issue Q6 in `sprint5-issues-updated.md` for the full specification.

#### Technical Notes

**Recursive answer component** — the key implementation challenge:

```typescript
// components/forum/AnswerThread.tsx
interface AnswerThreadProps {
  answer: Answer;
  questionId: number;
  questionAuthorEmail: string;
  depth?: number;
}

export function AnswerThread({
  answer,
  questionId,
  questionAuthorEmail,
  depth = 0,
}: AnswerThreadProps) {
  const { user } = useAuth();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const MAX_INDENT_DEPTH = 6;  // stop indenting past this level
  const indentPx = Math.min(depth, MAX_INDENT_DEPTH) * 16;

  return (
    <div style={{ marginLeft: indentPx }}>
      {/* answer body, vote buttons, accept button, reply button */}

      {showReplyForm && (
        <InlineReplyForm
          questionId={questionId}
          parentId={answer.id}
          onSubmit={() => setShowReplyForm(false)}
        />
      )}

      {answer.replies?.map(reply => (
        <AnswerThread
          key={reply.id}
          answer={reply}
          questionId={questionId}
          questionAuthorEmail={questionAuthorEmail}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
```

**Monaco Editor in reply/answer forms** — always dynamic import:
```typescript
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then(m => m.default),
  { ssr: false, loading: () => <div className="h-40 bg-gray-100 animate-pulse rounded" /> }
);
```

**Accept answer — only show the button when all conditions are true:**
```typescript
const canShowAcceptButton = (answer: Answer): boolean =>
  user?.email === question.author_email &&   // current user is question author
  question.can_accept_answer &&              // 24h has passed
  !question.accepted_answer_id &&            // no accepted answer yet
  answer.parent === null;                    // only top-level answers
```

#### Related Issues
- Depends on: F1, F2

---

### Issue F4: [Frontend] Plagiarism Report Page

**Labels:** `frontend`, `ui`, `plagiarism`
**Branch:** `frontend/plagiarism-report-page`
**Assigned to:** Frontend Dev 3
**Estimated time:** 4–5 hours

#### Description
Implement `pages/assignments/[id]/plagiarism.tsx`. Professor-only page.
Refer to Issue P6 in `sprint5-issues-updated.md` for the full specification.
Include AI flag indicators (Issue AI3) directly in this page — they are
just an extra visual indicator on the results table.

#### Technical Notes

**Import after F1:**
```typescript
import { useAuth } from '@/context/AuthContext';
import { triggerPlagiarismCheck, getPlagiarismReport } from '@/services/plagiarism';
import type { PlagiarismReport, SimilarityMatch } from '@/services/plagiarism';
```

**Polling implementation** (stop polling once complete or failed):
```typescript
useEffect(() => {
  if (!report || report.status === 'complete' || report.status === 'failed') return;

  const interval = setInterval(async () => {
    try {
      const updated = await getPlagiarismReport(Number(router.query.id));
      setReport(updated);
    } catch {
      clearInterval(interval);
    }
  }, 5000);

  return () => clearInterval(interval);
}, [report?.status, router.query.id]);
```

**AI flag indicator** — add to the `SimilarityMatch` type and table:
```typescript
// In plagiarism.types.ts — add to SimilarityMatch interface:
ai_moss_flag: boolean;

// In the table row:
{match.ai_moss_flag && (
  <span title="One submission matched an AI-generated reference solution">
    🤖 AI flag
  </span>
)}
```

**Row color by severity:**
```typescript
const getRowClass = (maxSimilarity: number): string => {
  if (maxSimilarity >= 70) return 'bg-red-50 border-l-4 border-red-400';
  if (maxSimilarity >= 50) return 'bg-orange-50 border-l-4 border-orange-400';
  return 'bg-green-50 border-l-4 border-green-300';
};
```

#### Related Issues
- Depends on: F1

---

### Issue F5: [Frontend] Forgot Password Page

**Labels:** `frontend`, `ui`, `auth`
**Branch:** `frontend/forgot-password-page`
**Assigned to:** Frontend Dev 2
**Estimated time:** 2 hours

#### Description
Implement two pages: `pages/forgot-password.tsx` and `pages/reset-password.tsx`.
These are public pages (no auth required). The link on the login page
currently says "Forgot password?" but goes nowhere — fix that too.

#### Technical Notes

**`pages/forgot-password.tsx`:**
- Single email field
- Calls `POST /api/auth/forgot-password/`
- On response (200 regardless of whether email exists): show success message
  "If this email is registered, a reset link has been sent."
- Do not show different messages for found vs not-found — this prevents
  user enumeration (someone checking which emails are registered)

**`pages/reset-password.tsx`:**
- Read `?token=` from query params: `router.query.token`
- If no token: redirect to `/forgot-password`
- Fields: new password + confirm password
- Calls `POST /api/auth/reset-password/`
- On success: show "Password reset successfully" + link to `/login`
- On error (expired token): show "This link has expired" + link to `/forgot-password`

**Update `pages/login.tsx`:**
```typescript
// Change the placeholder "Forgot password?" link
<Link href="/forgot-password">Forgot password?</Link>
```

**Both pages should be added to PUBLIC_PATHS in `AuthContext.tsx`** —
they're already there if you used the F1 code exactly.

#### Related Issues
- Depends on: F1, B2

---

### Issue F6: [Frontend] Style Refresh — Phase 1

**Labels:** `frontend`, `ui`, `design`
**Branch:** `frontend/style-refresh-phase1`
**Assigned to:** All three frontend devs (coordinate to avoid conflicts)
**Estimated time:** 8–10 hours total
**Note:** This issue runs in parallel with F2, F3, F4 but should not block them.
Work on separate pages/components to avoid merge conflicts.

#### Description
Restyle the platform to look polished and professional for the demo presentation.
Focus on the most visible surfaces: navigation, landing page, home dashboard,
and the shared card/table components used everywhere. Don't redesign logic —
only visual presentation changes.

#### Division of Work to Avoid Conflicts

| Dev | Owns |
|-----|------|
| Frontend Dev 1 | Global layout, Navbar, Footer, Button/Input component styles |
| Frontend Dev 2 | Landing page (`/`), Login page, Register pages |
| Frontend Dev 3 | Home dashboard (`/home`), Assignment cards, Submission cards |

#### Technical Notes

**Design direction — refined dark academic:**
The platform is used by ESI students and professors. It should look serious,
not playful. Think clean dark navy with sharp blue accents — not purple gradients,
not white corporate, not startup-green.

**Add to `styles/globals.css`** — a CSS variable system so the whole team
uses consistent values:

```css
:root {
  /* Core palette */
  --color-bg:          #0f1117;
  --color-surface:     #1a1d27;
  --color-surface-2:   #242736;
  --color-border:      #2e3245;
  --color-accent:      #4f7ef8;
  --color-accent-hover:#6b93ff;
  --color-success:     #34c77b;
  --color-warning:     #f5a623;
  --color-danger:      #e5534b;
  --color-text:        #e8eaf0;
  --color-text-muted:  #8892a4;

  /* Typography */
  --font-display: 'DM Sans', sans-serif;
  --font-body:    'IBM Plex Mono', monospace;

  /* Spacing scale */
  --radius-sm:  4px;
  --radius-md:  8px;
  --radius-lg:  12px;
}
```

Add to `pages/_document.tsx` (create if it doesn't exist):
```typescript
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

**What to change on each surface:**

*Navbar:* Dark surface background, accent-colored active link indicator,
clean logo lockup, no clutter.

*Cards (submissions, assignments):* Surface-2 background, 1px border using
`--color-border`, subtle hover state (border color shifts to accent).
No drop shadows — borders are cleaner.

*Buttons:* Primary = accent fill with white text. Secondary = transparent
with accent border and accent text. Danger = `--color-danger`.
Consistent border-radius using `--radius-md`.

*Tables (assignments list, plagiarism results):* Striped rows using
surface vs surface-2. Sticky header. No horizontal scroll on mobile.

*Forms (login, register):* Dark input fields, visible focus ring using
accent color, error states in red.

**What NOT to change in this sprint:**
- Monaco Editor theme (already dark, leave it)
- The plagiarism result row colors (defined in F4 using red/orange/green — intentional)
- Any component that contains complex state logic — style only, no behavior changes

#### Related Issues
- Depends on: F1 (for consistent auth state in Navbar)
- Can run in parallel with F2, F3, F4 — work on different files

---

## Implementation Order by Day

```
Day 1:
  - Dhia:    D4 (Cloud SQL setup)
  - BE Dev1: B1 (Gmail SMTP + Celery tasks)
  - BE Dev2: B3 review and merge
  - FE Dev1: F1 (Auth Context — MUST merge today, it unblocks everyone)

Day 2:
  - Dhia:    D2 (Cloud Run backend deployment)
  - BE Dev1: B2 (Forgot password)
  - BE Dev2: B4 (Forum N+1 fix)
  - FE Dev1: F2 (Forum list page) — after F1 merged
  - FE Dev2: F3 starts (Forum question pages)
  - FE Dev3: F4 starts (Plagiarism page)

Day 3:
  - Dhia:    D3 (Vercel deployment) + D1 (DNS)
  - FE Dev2: F3 continues, F5 (Forgot password page) after B2 done
  - FE Dev3: F4 continues, F6 starts (style refresh — their assigned pages)
  - FE Dev1: F6 (style refresh — navbar and globals)

Day 4–5:
  - Dhia:    D5 (Celery on Cloud Run) + D6 (GitHub Actions)
  - All FE:  F6 continues, QA testing on deployed frontend
  - All BE:  Bug fixes from first real deployment, test email flow end-to-end

Day 6–7:
  - All:     Integration testing on production URL
  - All:     Fix any deployment bugs
  - Dhia:    Smoke test: register a student, submit an assignment,
             trigger plagiarism check, post a forum question
  - Docs:    Note what still needs documentation (separate from this sprint)
```
