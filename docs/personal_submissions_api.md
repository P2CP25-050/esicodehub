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