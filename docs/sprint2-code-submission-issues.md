# Sprint 2 — Code Submission Issues

---

## PRE-SPRINT SETUP

---

### Issue 0: [DevOps] Set Up Google Cloud Storage

**Labels:** `devops`, `infrastructure`
**Branch:** `backend/gcs-setup`
**Assigned to:** Team Lead (Dhia)

#### Description
Set up Google Cloud Storage to store uploaded code files and directories. This is a blocker for all submission-related backend work and must be completed before any other issue in this sprint starts.

#### Technical Notes

**Step 1 — Create GCS bucket:**
- Go to console.cloud.google.com
- Create a new project: `esicodehub`
- Go to Cloud Storage → Create bucket
- Name: `esicodehub-submissions`
- Region: `europe-west1` (closest to Algeria)
- Access control: **Uniform**
- Public access: **Prevent public access** (files accessed through signed URLs only)

**Step 2 — Create a service account:**
- Go to IAM & Admin → Service Accounts
- Create service account: `esicodehub-backend`
- Role: **Storage Object Admin**
- Download JSON key file — this is your credentials file

**Step 3 — Add to backend:**

Add to `requirements/base.txt`:
```
django-storages[google]
google-cloud-storage
```

Add to `config/settings/base.py`:
```python
DEFAULT_FILE_STORAGE = 'storages.backends.gcloud.GoogleCloudStorage'
GS_BUCKET_NAME = os.getenv('GCS_BUCKET_NAME')
GS_CREDENTIALS = os.getenv('GCS_CREDENTIALS_PATH')
GS_FILE_OVERWRITE = False
GS_DEFAULT_ACL = None
GS_EXPIRATION = 3600  # signed URL expiry in seconds
```

Add to `.env` and `.env.example`:
```env
GCS_BUCKET_NAME=esicodehub-submissions
GCS_CREDENTIALS_PATH=/path/to/service-account-key.json
```

**Step 4 — Add credentials to Docker:**

In `docker-compose.yml`, mount the credentials file:
```yaml
backend:
  volumes:
    - ./backend:/app/backend
    - ./backend/staticfiles:/app/backend/staticfiles
    - ./gcs-credentials.json:/app/gcs-credentials.json
```

Add to `.gitignore`:
```
gcs-credentials.json
```

**Step 5 — Write a test to verify GCS connection:**
```python
# Run this to verify setup works
docker-compose exec backend python manage.py shell -c "
from google.cloud import storage
client = storage.Client()
bucket = client.bucket('esicodehub-submissions')
print('GCS connection successful:', bucket.exists())
"
```

#### Related Issues
- Blocks: all backend submission issues

---

## BACKEND ISSUES

---

### Issue 1: [Backend] Submission and File Models

**Labels:** `backend`, `models`
**Branch:** `backend/submission-models`

#### Description
Implement the database models for code submissions. A submission represents a code project uploaded by a student or professor. It can contain one or more files stored in Google Cloud Storage.

#### Technical Notes

Create a new app:
```bash
python manage.py startapp submissions
mv submissions apps/submissions
```

Add `submissions` to `INSTALLED_APPS`.

**`Submission` model:**
```python
class Submission(models.Model):
    class SubmissionType(models.TextChoices):
        REVIEW   = 'review',   'Review Request'
        HELP     = 'help',     'Help Request'
        SHARING  = 'sharing',  'Educational Sharing'

    class Visibility(models.TextChoices):
        PUBLIC  = 'public',  'Public'
        PRIVATE = 'private', 'Private'

    owner       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submissions'
    )
    title           = models.CharField(max_length=255)
    description     = models.TextField(blank=True)
    language        = models.CharField(max_length=50)
    course_tag      = models.CharField(max_length=100, blank=True)
    submission_type = models.CharField(max_length=20, choices=SubmissionType.choices)
    visibility      = models.CharField(
        max_length=10,
        choices=Visibility.choices,
        default=Visibility.PUBLIC
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} by {self.owner.email}"

    class Meta:
        ordering = ['-created_at']
        db_table = 'submissions'
```

**`SubmissionFile` model:**
```python
class SubmissionFile(models.Model):
    submission  = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name='files'
    )
    file        = models.FileField(upload_to='submissions/')
    file_name   = models.CharField(max_length=255)
    file_path   = models.CharField(max_length=500)  # relative path within project
    file_size   = models.PositiveIntegerField()      # in bytes
    created_at  = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.file_name} ({self.submission.title})"

    class Meta:
        db_table = 'submission_files'
```

**Notes:**
- `file_path` stores the relative path within the project directory (e.g. `src/main.py`) so directory structure is preserved
- `file` field uses Django's FileField which integrates with GCS through `django-storages`
- Always use `settings.AUTH_USER_MODEL` for the owner ForeignKey
- Run `makemigrations submissions` and `migrate` after implementation
- Register both models in `apps/submissions/admin.py`

#### Related Issues
- Depends on: Issue 0 (GCS setup)
- Blocks: Issues 2, 3, 4

---

### Issue 2: [Backend] Submission Serializers

**Labels:** `backend`, `serializers`
**Branch:** `backend/submission-serializers`

#### Description
Implement DRF serializers for creating, listing, and retrieving submissions. The serializers handle validation and data transformation between the API layer and the models.

#### Technical Notes

Create `apps/submissions/serializers.py`:

**`SubmissionFileSerializer`:**
```python
class SubmissionFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionFile
        fields = ['id', 'file_name', 'file_path', 'file_size', 'file']
        read_only_fields = ['id', 'file_size']
```

**`SubmissionListSerializer`** (for listing — minimal data):
```python
class SubmissionListSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()
    file_count = serializers.SerializerMethodField()

    def get_owner_name(self, obj):
        return f"{obj.owner.first_name} {obj.owner.last_name}"

    def get_file_count(self, obj):
        return obj.files.count()

    class Meta:
        model = Submission
        fields = [
            'id', 'title', 'description', 'language',
            'course_tag', 'submission_type', 'visibility',
            'owner_name', 'file_count', 'created_at'
        ]
```

**`SubmissionDetailSerializer`** (for single submission — full data):
```python
class SubmissionDetailSerializer(serializers.ModelSerializer):
    files    = SubmissionFileSerializer(many=True, read_only=True)
    owner    = serializers.SerializerMethodField()

    def get_owner(self, obj):
        return {
            'email': obj.owner.email,
            'first_name': obj.owner.first_name,
            'last_name': obj.owner.last_name,
            'role': obj.owner.role,
        }

    class Meta:
        model = Submission
        fields = [
            'id', 'title', 'description', 'language',
            'course_tag', 'submission_type', 'visibility',
            'owner', 'files', 'created_at', 'updated_at'
        ]
```

**`SubmissionCreateSerializer`** (for creating):
```python
class SubmissionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = [
            'title', 'description', 'language',
            'course_tag', 'submission_type', 'visibility'
        ]

    def validate_language(self, value):
        return value.strip().lower()
```

#### Related Issues
- Depends on: Issue 1 (Submission models)
- Blocks: Issues 3, 4

---

### Issue 3: [Backend] Submission CRUD API

**Labels:** `backend`, `api`
**Branch:** `backend/submission-api`

#### Description
Implement the REST API endpoints for creating, reading, updating, and deleting submissions. File uploads are handled separately in Issue 4.

#### Technical Notes

**Endpoints to implement:**

`GET /api/submissions/` — List all public submissions
- No authentication required for public submissions
- Authenticated users also see their own private submissions
- Support query params: `?language=python`, `?type=review`, `?course=algo`, `?search=title`
- Return `SubmissionListSerializer`
- Paginate results: 20 per page

`POST /api/submissions/` — Create a new submission
- Authentication required
- Use `SubmissionCreateSerializer` for input
- Set `owner` to `request.user` automatically
- Return `SubmissionDetailSerializer` on success
- Return 201 on success

`GET /api/submissions/<id>/` — Get a single submission
- Public submissions: no auth required
- Private submissions: only owner can view
- Return `SubmissionDetailSerializer`
- Return 404 if not found, 403 if private and not owner

`PATCH /api/submissions/<id>/` — Update a submission
- Authentication required
- Only owner can update
- Allowed fields: `title`, `description`, `language`, `course_tag`, `submission_type`, `visibility`
- Return updated `SubmissionDetailSerializer`
- Return 403 if not owner

`DELETE /api/submissions/<id>/` — Delete a submission
- Authentication required
- Only owner can delete
- Also deletes all associated files from GCS
- Return 204 on success
- Return 403 if not owner

**Wire up URLs in `apps/submissions/urls.py`:**
```python
from django.urls import path
from apps.submissions import views

urlpatterns = [
    path('', views.submission_list, name='submission-list'),
    path('<int:pk>/', views.submission_detail, name='submission-detail'),
]
```

Add to `config/urls.py`:
```python
path('api/submissions/', include('apps.submissions.urls')),
```

**Pagination setup in `config/settings/base.py`:**
```python
REST_FRAMEWORK = {
    ...
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}
```

#### Related Issues
- Depends on: Issues 1, 2
- Blocks: Issues 4, Frontend Issues

---

### Issue 4: [Backend] File Upload API

**Labels:** `backend`, `api`
**Branch:** `backend/file-upload-api`

#### Description
Implement the file upload endpoint that handles uploading one or more files to an existing submission and storing them in Google Cloud Storage.

#### Technical Notes

**Endpoint:**

`POST /api/submissions/<id>/files/` — Upload files to a submission
- Authentication required, owner only
- Accept `multipart/form-data`
- Accept multiple files in a single request
- For each file:
  - Validate file size (max 10MB per file)
  - Validate total submission size (max 50MB)
  - Store in GCS under path: `submissions/<user_id>/<submission_id>/<file_path>`
  - Create `SubmissionFile` record
- Return list of uploaded files
- Return 400 if file too large
- Return 403 if not owner

`DELETE /api/submissions/<id>/files/<file_id>/` — Delete a single file
- Authentication required, owner only
- Delete from GCS
- Delete `SubmissionFile` record
- Return 204 on success

`GET /api/submissions/<id>/files/<file_id>/content/` — Get file content
- Returns the raw file content as text for the code viewer
- Public files: no auth required
- Private files: owner only
- Return 400 if file is binary (not text)

**File size validation:**
```python
MAX_FILE_SIZE = 10 * 1024 * 1024   # 10MB per file
MAX_SUBMISSION_SIZE = 50 * 1024 * 1024  # 50MB total

def validate_file_size(file):
    if file.size > MAX_FILE_SIZE:
        raise serializers.ValidationError(
            f'File too large. Maximum size is 10MB.'
        )
```

**GCS path structure:**
```
submissions/
  {user_id}/
    {submission_id}/
      main.py
      utils/
        helpers.py
```

Add to `apps/submissions/urls.py`:
```python
path('<int:pk>/files/', views.submission_files, name='submission-files'),
path('<int:pk>/files/<int:file_id>/', views.submission_file_detail, name='submission-file-detail'),
path('<int:pk>/files/<int:file_id>/content/', views.submission_file_content, name='submission-file-content'),
```

#### Related Issues
- Depends on: Issues 0, 1, 2, 3
- Blocks: Frontend Issues

---

## FRONTEND ISSUES

---

### Issue 5: [Frontend] Submission API Service

**Labels:** `frontend`, `api`
**Branch:** `frontend/submission-api-service`

#### Description
Create the TypeScript service layer for all submission-related API calls. Must be built before any UI components.

#### Technical Notes

Create `frontend/services/submissions.ts`:

```typescript
import apiClient from '@/lib/axios';

// ─── Types ────────────────────────────────────────────────
export interface SubmissionFile {
  id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  file: string;  // GCS URL
}

export interface SubmissionOwner {
  email: string;
  first_name: string;
  last_name: string;
  role: 'student' | 'professor';
}

export interface Submission {
  id: number;
  title: string;
  description: string;
  language: string;
  course_tag: string;
  submission_type: 'review' | 'help' | 'sharing';
  visibility: 'public' | 'private';
  owner: SubmissionOwner;
  owner_name?: string;
  file_count?: number;
  files?: SubmissionFile[];
  created_at: string;
  updated_at?: string;
}

export interface SubmissionCreatePayload {
  title: string;
  description: string;
  language: string;
  course_tag: string;
  submission_type: 'review' | 'help' | 'sharing';
  visibility: 'public' | 'private';
}

export interface SubmissionListParams {
  language?: string;
  type?: string;
  course?: string;
  search?: string;
  page?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── API calls ─────────────────────────────────────────────
export const listSubmissions = (params?: SubmissionListParams) =>
  apiClient.get<PaginatedResponse<Submission>>('/submissions/', { params });

export const getSubmission = (id: number) =>
  apiClient.get<Submission>(`/submissions/${id}/`);

export const createSubmission = (data: SubmissionCreatePayload) =>
  apiClient.post<Submission>('/submissions/', data);

export const updateSubmission = (id: number, data: Partial<SubmissionCreatePayload>) =>
  apiClient.patch<Submission>(`/submissions/${id}/`, data);

export const deleteSubmission = (id: number) =>
  apiClient.delete(`/submissions/${id}/`);

export const uploadFiles = (id: number, files: File[], filePaths: string[]) => {
  const formData = new FormData();
  files.forEach((file, index) => {
    formData.append('files', file);
    formData.append('file_paths', filePaths[index]);
  });
  return apiClient.post<SubmissionFile[]>(
    `/submissions/${id}/files/`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
};

export const deleteFile = (submissionId: number, fileId: number) =>
  apiClient.delete(`/submissions/${submissionId}/files/${fileId}/`);

export const getFileContent = (submissionId: number, fileId: number) =>
  apiClient.get<string>(`/submissions/${submissionId}/files/${fileId}/content/`);
```

#### Related Issues
- Depends on: nothing (build in parallel with backend)
- Blocks: Issues 6, 7, 8, 9

---

### Issue 6: [Frontend] Upload Submission Page

**Labels:** `frontend`, `ui`
**Branch:** `frontend/upload-submission-page`

#### Description
Implement the page where users upload a new code submission with files and metadata.

#### Technical Notes

Create `frontend/pages/submissions/new.tsx`

**The page has two steps:**

**Step 1 — Metadata form:**
- Title input (required)
- Description textarea (optional)
- Language input with autocomplete suggestions (Python, C, C++, Java, JavaScript, etc.)
- Course tag input (optional)
- Submission type selector: Review Request / Help Request / Educational Sharing
- Visibility toggle: Public / Private
- Next button → goes to Step 2

**Step 2 — File upload:**
- Drag and drop zone accepting any file type
- Also accept directory upload via `webkitdirectory` attribute:
  ```typescript
  <input
    type="file"
    multiple
    // @ts-ignore
    webkitdirectory=""
    onChange={handleDirectoryUpload}
  />
  ```
- Show list of selected files with their paths
- Allow removing individual files before submitting
- Show total size and file count
- Submit button

**On submit:**
1. Call `createSubmission()` with metadata
2. Call `uploadFiles()` with the files and their relative paths
3. On success redirect to `/submissions/<id>`
4. Show progress indicator during upload

**Wrap page with `ProtectedRoute`:**
```typescript
export default function NewSubmissionPage() {
  return (
    <ProtectedRoute>
      {/* page content */}
    </ProtectedRoute>
  );
}
```

**Validation:**
- Title required, max 255 characters
- At least one file required
- Total size must not exceed 50MB — show warning if exceeded
- Show individual file sizes in the file list

#### Related Issues
- Depends on: Issue 5
- Blocks: nothing

---

### Issue 7: [Frontend] Submission Detail Page with Code Viewer

**Labels:** `frontend`, `ui`
**Branch:** `frontend/submission-detail-page`

#### Description
Implement the page that displays a single submission with its files and a Monaco Editor code viewer.

#### Technical Notes

Create `frontend/pages/submissions/[id].tsx`

**Install Monaco Editor:**
```bash
npm install @monaco-editor/react
```

**Page layout:**
```
┌─────────────────────────────────────────┐
│ Title          [Edit] [Delete] (if owner)│
│ Owner • Language • Type • Date           │
│ Description                              │
├──────────────┬──────────────────────────┤
│ File tree    │ Monaco Editor             │
│ > main.py    │                           │
│ > utils/     │  (file content here)      │
│   helpers.py │                           │
└──────────────┴──────────────────────────┘
```

**File tree:**
- Show all files in the submission
- Clicking a file loads its content in the editor
- Highlight currently selected file

**Monaco Editor setup:**
```typescript
import Editor from '@monaco-editor/react';

<Editor
  height="600px"
  language={detectLanguage(selectedFile.file_name)}
  value={fileContent}
  theme="vs-dark"
  options={{
    readOnly: true,
    minimap: { enabled: false },
    fontSize: 14,
    wordWrap: 'on',
  }}
/>
```

**Language detection:**
```typescript
const detectLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    py: 'python', js: 'javascript', ts: 'typescript',
    c: 'c', cpp: 'cpp', java: 'java', cs: 'csharp',
    html: 'html', css: 'css', json: 'json', md: 'markdown',
  };
  return map[ext || ''] || 'plaintext';
};
```

**Loading file content:**
- On file click, call `getFileContent()` from submissions service
- Show loading state in editor while fetching
- Cache loaded file contents in local state to avoid refetching

**Owner actions:**
- Show Edit and Delete buttons only if `user.email === submission.owner.email`
- Delete shows confirmation dialog before calling `deleteSubmission()`
- Edit navigates to `/submissions/<id>/edit`

#### Related Issues
- Depends on: Issue 5
- Blocks: nothing

---

### Issue 8: [Frontend] Edit Submission Page

**Labels:** `frontend`, `ui`
**Branch:** `frontend/edit-submission-page`

#### Description
Implement the page for editing an existing submission's metadata and managing its files.

#### Technical Notes

Create `frontend/pages/submissions/[id]/edit.tsx`

**The page has two tabs:**

**Tab 1 — Edit metadata:**
- Same fields as the upload page (title, description, language, course tag, type, visibility)
- Pre-populated with current submission data
- Save button calls `updateSubmission()`

**Tab 2 — Manage files:**
- Show current files with delete button per file
- Add new files section (same drag and drop as upload page)
- Deleting a file calls `deleteFile()`
- Adding files calls `uploadFiles()`

**Access control:**
- Wrap with `ProtectedRoute`
- If `user.email !== submission.owner.email` redirect to `/submissions/<id>`

#### Related Issues
- Depends on: Issue 5
- Blocks: nothing

---

### Issue 9: [Frontend] Submissions List Page with Search and Filter

**Labels:** `frontend`, `ui`
**Branch:** `frontend/submissions-list-page`

#### Description
Implement the main submissions browsing page where users can search and filter public submissions.

#### Technical Notes

Create `frontend/pages/submissions/index.tsx`

**Page layout:**
```
┌─────────────────────────────────────┐
│ [Search bar                    🔍]   │
│ Language ▼  Type ▼  Course ▼         │
├─────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐           │
│ │Submission│ │Submission│  ...       │
│ │  Card    │ │  Card    │           │
│ └──────────┘ └──────────┘           │
│         [Load more]                  │
└─────────────────────────────────────┘
```

**Submission card shows:**
- Title
- Owner name
- Language badge
- Submission type badge
- File count
- Date

**Filters:**
- Search by title (debounced 300ms)
- Filter by language (dropdown)
- Filter by submission type (dropdown)
- Filter by course tag (text input)

**Pagination:**
- Load 20 submissions per page
- "Load more" button fetches next page and appends to list
- Show total count

**On card click:** navigate to `/submissions/<id>`

**Upload button:** visible only to authenticated users, navigates to `/submissions/new`

This page is **public** — no auth required to view. Use `listSubmissions()` from the submissions service.

#### Related Issues
- Depends on: Issue 5
- Blocks: nothing
