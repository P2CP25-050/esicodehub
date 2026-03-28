# Personal Submissions API Documentation

## Base URL
```
http://localhost:8000/api
```

---

## Personal Submissions Endpoints

### 1. List Submissions
**GET** `/personal-submissions/`

**Auth:** Not required (public submissions only for unauthenticated users)

**Query Parameters:**
| Param | Description | Example |
|-------|-------------|---------|
| `language` | Filter by language | `?language=python` |
| `type` | Filter by submission type | `?type=review` |
| `course` | Filter by course tag | `?course=ASD101` |
| `search` | Search by title | `?search=sorting` |

**Response 200:**
```json
{
  "count": 100,
  "next": "http://localhost:8000/api/personal-submissions/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "Sorting Algorithm",
      "language": "Python",
      "course_tag": "ASD101",
      "submission_type": "review",
      "visibility": "public",
      "owner": "student@esi.dz",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### 2. Create Submission
**POST** `/personal-submissions/`

**Auth:** Required

**Request:**
```json
{
  "title": "Sorting Algorithm",
  "description": "My implementation of quicksort",
  "language": "Python",
  "course_tag": "ASD101",
  "submission_type": "review",
  "visibility": "public"
}
```

**Submission Type Choices:**
| Value | Description |
|-------|-------------|
| `review` | Asking for code review |
| `help` | Asking for help |
| `sharing` | Sharing code with others |

**Visibility Choices:**
| Value | Description |
|-------|-------------|
| `public` | Visible to everyone |
| `private` | Visible to owner only |

**Response 201:**
```json
{
  "id": 1,
  "title": "Sorting Algorithm",
  "description": "My implementation of quicksort",
  "language": "Python",
  "course_tag": "ASD101",
  "submission_type": "review",
  "visibility": "public",
  "gcs_prefix": "personal/1/1/",
  "owner": "student@esi.dz",
  "files": [],
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

**Response 401:**
```json
{ "detail": "Authentication credentials were not provided." }
```

---

### 3. Get Single Submission
**GET** `/personal-submissions/<id>/`

**Auth:** Not required for public submissions

**Response 200:**
```json
{
  "id": 1,
  "title": "Sorting Algorithm",
  "description": "My implementation of quicksort",
  "language": "Python",
  "course_tag": "ASD101",
  "submission_type": "review",
  "visibility": "public",
  "gcs_prefix": "personal/1/1/",
  "owner": "student@esi.dz",
  "files": [
    {
      "id": 1,
      "file_name": "main.py",
      "file_path": "main.py",
      "gcs_path": "personal/1/1/main.py",
      "file_size": 1024,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

### 4. Update Submission
**PATCH** `/personal-submissions/<id>/`

**Auth:** Required, owner only

**Updatable fields only:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "language": "Java",
  "course_tag": "OS201",
  "submission_type": "help",
  "visibility": "private"
}
```

**Response 200:**
```json
{
  "id": 1,
  "title": "Updated Title",
  "description": "Updated description",
  "language": "Java",
  "course_tag": "OS201",
  "submission_type": "help",
  "visibility": "private",
  "gcs_prefix": "personal/1/1/",
  "owner": "student@esi.dz",
  "files": [],
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T01:00:00Z"
}
```

**Response 400:**
```json
{
  "detail": "Only title, description, language, course_tag, submission_type, visibility can be updated."
}
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

### 5. Delete Submission
**DELETE** `/personal-submissions/<id>/`

**Auth:** Required, owner only

**Response 204:** No content

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

## Notes
- All endpoints require `Content-Type: application/json`
- List endpoint is paginated — **20 items per page**
- `gcs_prefix` is auto-generated as `personal/{user_id}/{submission_id}/`
- Deleting a submission also deletes all its files from Google Cloud Storage
- Private submissions are only visible to their owner

---

## File Endpoints

---

### 6. Upload Files
**POST** `/personal-submissions/<id>/files/`

**Auth:** Required, owner only

**Request:** `multipart/form-data`
| Field | Description |
|-------|-------------|
| `files` | One or more code files |
| `file_paths` | Matching relative paths for each file |

**Response 201:**
```json
[
  {
    "id": 1,
    "file_name": "main.py",
    "file_path": "main.py",
    "file_size": 1024,
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

**Response 400:**
```json
{ "detail": "main.py exceeds the 10MB per file limit" }
```
```json
{ "detail": "Total submission size would exceed the 50MB limit" }
```
```json
{ "detail": "File type .exe is not allowed." }
```
```json
{ "detail": "Security Error: File content type (application/x-executable) is not allowed." }
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

### 7. Delete File
**DELETE** `/personal-submissions/<id>/files/<file_id>/`

**Auth:** Required, owner only

**Response 204:** No content

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

**Response 404:**
```json
{ "detail": "No PersonalSubmissionFile matches the given query." }
```

---

### 8. Get File Content
**GET** `/personal-submissions/<id>/files/<file_id>/content/`

**Auth:** Not required for public submissions, owner only for private

**Response 200:**
```json
{ "content": "def hello():\n    print('Hello, World!')\n" }
```

**Response 400:**
```json
{ "detail": "File is binary and cannot be displayed as text" }
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

## File Upload Notes
- Accepted files: any text-based code file
- Rejected files: `.exe`, `.dll`, `.so`, `.dylib`, `.bin`, `.bat`, `.cmd`, `.ps1`, `.vbs`
- Max file size: **10MB per file**
- Max total submission size: **50MB**
- File content must be text-based — binary files are rejected via MIME type check