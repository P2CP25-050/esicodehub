# Assignment Submission and Review API Documentation

## Base URL
```
http://localhost:8000/api
```

---

## Authentication

All endpoints require a JWT Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## Roles

| Role | Permissions |
|------|-------------|
| `student` | Submit files, view own submission, view reviews on own submission |
| `professor` | View all submissions, review submissions, view file content |

---

## Student Submission Endpoints

### 1. Submit Files to Assignment
**POST** `/assignments/<id>/submit/`

**Auth:** Required — Student only

**Request:** `multipart/form-data`
| Field | Description |
|-------|-------------|
| `files` | One or more code files |
| `file_paths` | Matching relative paths for each file |

**Response 201:**
```json
{
  "id": 1,
  "student_name": "Kessab Mohamed Nour",
  "student_email": "om_kessab@esi.dz",
  "submitted_at": "2026-01-01T10:00:00Z",
  "is_late": false,
  "file_count": 2,
  "has_reviews": false,
  "files": [
    {
      "id": 1,
      "file_name": "main.py",
      "file_path": "main.py",
      "file_size": 1024,
      "created_at": "2026-01-01T10:00:00Z"
    }
  ],
  "reviews": []
}
```

**Response 400 — File too large:**
```json
{ "detail": "main.py exceeds the 10MB per file limit." }
```

**Response 400 — Total size exceeded:**
```json
{ "detail": "Total submission size would exceed the 50MB limit." }
```

**Response 400 — Invalid file path:**
```json
{ "detail": "Invalid file path: ../../etc/passwd" }
```

**Response 400 — Invalid file type:**
```json
{ "detail": "Security Error: File content type (application/x-executable) is not allowed." }
```

**Response 403 — Not a student:**
```json
{ "detail": "You do not have permission to perform this action." }
```

**Response 403 — Not targeted:**
```json
{ "detail": "You are not targeted by this assignment." }
```

**Response 403 — Closed:**
```json
{ "detail": "This assignment is closed for submission." }
```

> ⚠️ **Resubmission behavior** — if the student already has a submission, all previous files are deleted from GCS and replaced with the new ones. `is_late` is updated to reflect the new submission time.

---

### 2. Get My Submission
**GET** `/assignments/<id>/my-submission/`

**Auth:** Required — Student only

**Response 200:**
```json
{
  "id": 1,
  "student_name": "Kessab Mohamed Nour",
  "student_email": "om_kessab@esi.dz",
  "submitted_at": "2026-01-01T10:00:00Z",
  "is_late": false,
  "file_count": 2,
  "has_reviews": true,
  "files": [
    {
      "id": 1,
      "file_name": "main.py",
      "file_path": "main.py",
      "file_size": 1024,
      "created_at": "2026-01-01T10:00:00Z"
    }
  ],
  "reviews": [
    {
      "id": 1,
      "professor_name": "Kessab Mohamed Nour",
      "general_comment": "Good work overall.",
      "grade": "15.00",
      "created_at": "2026-01-02T10:00:00Z",
      "updated_at": "2026-01-02T10:00:00Z",
      "comments": []
    }
  ]
}
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

**Response 404:**
```json
{ "detail": "No AssignmentSubmission matches the given query." }
```

---

## Professor Submission Endpoints

### 3. List All Submissions
**GET** `/assignments/<id>/submissions/`

**Auth:** Required — Any professor

**Query Parameters:**
| Param | Description | Example |
|-------|-------------|---------|
| `group` | Filter by student group | `?group=1` |

**Response 200:**
```json
{
  "count": 25,
  "next": "http://localhost:8000/api/assignments/1/submissions/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "student_name": "Kessab Mohamed Nour",
      "student_email": "om_kessab@esi.dz",
      "submitted_at": "2026-01-01T10:00:00Z",
      "is_late": false,
      "file_count": 2,
      "has_reviews": false
    }
  ]
}
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

### 4. Get Single Submission Detail
**GET** `/assignments/<id>/submissions/<submission_id>/`

**Auth:** Required — Any professor

**Response 200:**
```json
{
  "id": 1,
  "student_name": "Kessab Mohamed Nour",
  "student_email": "om_kessab@esi.dz",
  "submitted_at": "2026-01-01T10:00:00Z",
  "is_late": false,
  "file_count": 2,
  "has_reviews": false,
  "files": [
    {
      "id": 1,
      "file_name": "main.py",
      "file_path": "main.py",
      "file_size": 1024,
      "created_at": "2026-01-01T10:00:00Z"
    }
  ],
  "reviews": []
}
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

**Response 404:**
```json
{ "detail": "No AssignmentSubmission matches the given query." }
```

---

### 5. Get File Content
**GET** `/assignments/<id>/submissions/<submission_id>/files/<file_id>/content/`

**Auth:** Required — Any professor

**Response 200:**
```
Content-Type: text/plain; charset=utf-8

def hello():
    print("Hello, World!")
```

**Response 400:**
```json
{ "detail": "File is binary and cannot be displayed as text." }
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

**Response 404:**
```json
{ "detail": "No AssignmentSubmissionFile matches the given query." }
```

---

### 6. Create or Replace Review
**POST** `/assignments/<id>/submissions/<submission_id>/reviews/`

**Auth:** Required — Any professor

**Request:**
```json
{
  "general_comment": "Good work overall.",
  "grade": 15.00,
  "comments": [
    {
      "file_id": 1,
      "line_number": 10,
      "content": "Consider using a more descriptive variable name here."
    }
  ]
}
```

**Field Reference:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `general_comment` | string | ❌ | Overall feedback |
| `grade` | decimal | ❌ | Grade out of 20 |
| `comments` | array | ❌ | List of line comments |
| `comments[].file_id` | integer | ✅ | ID of the file being commented on |
| `comments[].line_number` | integer | ✅ | Line number (min: 1) |
| `comments[].content` | string | ✅ | Comment text |

**Response 201:**
```json
{
  "id": 1,
  "professor_name": "Kessab Mohamed Nour",
  "general_comment": "Good work overall.",
  "grade": "15.00",
  "created_at": "2026-01-02T10:00:00Z",
  "updated_at": "2026-01-02T10:00:00Z",
  "comments": [
    {
      "id": 1,
      "file": 1,
      "line_number": 10,
      "content": "Consider using a more descriptive variable name here.",
      "created_at": "2026-01-02T10:00:00Z"
    }
  ]
}
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

> ⚠️ **Full replace behavior** — if the professor already has a review for this submission, all previous comments are deleted and replaced with the new ones.

---

### 7. Get All Reviews
**GET** `/assignments/<id>/submissions/<submission_id>/reviews/`

**Auth:** Required — Any professor or the submitting student

**Response 200:**
```json
[
  {
    "id": 1,
    "professor_name": "Kessab Mohamed Nour",
    "general_comment": "Good work overall.",
    "grade": "15.00",
    "created_at": "2026-01-02T10:00:00Z",
    "updated_at": "2026-01-02T10:00:00Z",
    "comments": [
      {
        "id": 1,
        "file": 1,
        "line_number": 10,
        "content": "Consider using a more descriptive variable name here.",
        "created_at": "2026-01-02T10:00:00Z"
      }
    ]
  }
]
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

## Notes
- All endpoints require `Content-Type: application/json` except file upload which uses `multipart/form-data`
- Submission list is paginated — **20 items per page**
- A student can only have **one submission per assignment** — resubmitting replaces all previous files
- `is_late` is set automatically based on whether the submission was made after the deadline
- File validation: max **10MB per file**, max **50MB total**, text-based files only
- Dangerous file extensions (`.exe`, `.dll`, `.bat`, etc.) are rejected
- Path traversal attempts in `file_paths` are rejected
- Grade must be between **0 and 20**
- Multiple professors can each leave their own review on the same submission