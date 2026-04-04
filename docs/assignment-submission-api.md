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


# Assignment Submissions API Documentation

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
| `professor` | Create assignments, manage own assignments, view all assignment details |
| `student` | View only assignments targeted at them |

---

## Target Year Choices

| Value | Meaning |
|-------|---------|
| `"1CP"` | First year preparatory cycle |
| `"2CP"` | Second year preparatory cycle |
| `"1CS"` | First year CS |
| `"2CS"` | Second year CS |
| `"3CS"` | Third year CS |

---

## Assignment Endpoints

### 1. List Assignments
**GET** `/assignments/`

**Auth:** Required

**Query Parameters (professor only):**
| Param | Description | Example |
|-------|-------------|---------|
| `group` | Filter by target group | `?group=1` |

**Response 200 — Professor:**
```json
{
  "count": 10,
  "next": "http://localhost:8000/api/assignments/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "Lab Report 1",
      "description": "Submit your lab report",
      "subject": {
        "id": 1,
        "name": "Algorithms and Data Structures",
        "code": "ASD101"
      },
      "target_year": "3CS",
      "target_sections": ["SIL"],
      "target_groups": [],
      "deadline": "2026-05-01T23:59:00Z",
      "allow_late": false,
      "is_open": true,
      "professor_name": "John Doe",
      "submission_count": 5
    }
  ]
}
```

**Response 200 — Student:**
```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "Lab Report 1",
      "description": "Submit your lab report",
      "subject": {
        "id": 1,
        "name": "Algorithms and Data Structures",
        "code": "ASD101"
      },
      "target_year": "3CS",
      "target_sections": ["SIL"],
      "target_groups": [],
      "deadline": "2026-05-01T23:59:00Z",
      "allow_late": false,
      "is_open": true,
      "professor_name": "John Doe",
      "submission_count": 5
    }
  ]
}
```

**Response 401:**
```json
{ "detail": "Authentication credentials were not provided." }
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

### 2. Create Assignment
**POST** `/assignments/`

**Auth:** Required — Professor only

**Request:**
```json
{
  "title": "Lab Report 1",
  "description": "Submit your lab report",
  "subject": 1,
  "deadline": "2026-05-01T23:59:00Z",
  "allow_late": false,
  "target_year": "3CS",
  "target_sections": ["SIL"],
  "target_groups": []
}
```

**Field Reference:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | Assignment title |
| `description` | string | ❌ | Assignment description |
| `subject` | integer | ✅ | Subject ID |
| `deadline` | datetime | ✅ | Submission deadline (ISO 8601) — must be in the future |
| `allow_late` | boolean | ❌ | Whether late submissions are allowed (default: false) |
| `target_year` | string | ✅ | Study year to target — one of `1CP`, `2CP`, `1CS`, `2CS`, `3CS` |
| `target_sections` | array | ❌ | List of sections to target e.g. `["SIL", "SIQ"]` |
| `target_groups` | array | ❌ | List of groups to target e.g. `["1", "2"]` |

> ⚠️ **`target_sections` and `target_groups` are mutually exclusive** — sending both will return a 400 error.

**Response 201:**
```json
{
  "id": 1,
  "title": "Lab Report 1",
  "description": "Submit your lab report",
  "subject": {
    "id": 1,
    "name": "Algorithms and Data Structures",
    "code": "ASD101"
  },
  "target_year": "3CS",
  "target_sections": ["SIL"],
  "target_groups": [],
  "deadline": "2026-05-01T23:59:00Z",
  "allow_late": false,
  "is_open": true,
  "professor_name": "John Doe",
  "submission_count": 0,
  "professor": {
    "email": "nt_boudjemaa@esi.dz",
    "first_name": "John",
    "last_name": "Doe"
  },
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

**Response 400 — Mutual exclusivity violation:**
```json
{
  "non_field_errors": [
    "target_sections and target_groups are mutually exclusive. Provide only one of them."
  ]
}
```

**Response 400 — Deadline in the past:**
```json
{ "deadline": ["Deadline must be in the future."] }
```

**Response 400 — Missing required fields:**
```json
{
  "title": ["This field is required."],
  "subject": ["This field is required."],
  "target_year": ["This field is required."],
  "deadline": ["This field is required."]
}
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

### 3. Get Single Assignment
**GET** `/assignments/<id>/`

**Auth:** Required

**Access rules:**
- Any professor → full detail ✅
- Targeted student → full detail ✅
- Non-targeted student → 403 ❌

**Response 200:**
```json
{
  "id": 1,
  "title": "Lab Report 1",
  "description": "Submit your lab report",
  "subject": {
    "id": 1,
    "name": "Algorithms and Data Structures",
    "code": "ASD101"
  },
  "target_year": "3CS",
  "target_sections": ["SIL"],
  "target_groups": [],
  "deadline": "2026-05-01T23:59:00Z",
  "allow_late": false,
  "is_open": true,
  "professor_name": "John Doe",
  "submission_count": 5,
  "professor": {
    "email": "nt_boudjemaa@esi.dz",
    "first_name": "John",
    "last_name": "Doe"
  },
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

**Response 404:**
```json
{ "detail": "No Assignment matches the given query." }
```

---

### 4. Update Assignment
**PATCH** `/assignments/<id>/`

**Auth:** Required — Creating professor only

**Updatable fields only:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "deadline": "2026-06-01T23:59:00Z",
  "allow_late": true
}
```

**Allowed vs Blocked fields:**
| Field | Updatable |
|-------|-----------|
| `title` | ✅ |
| `description` | ✅ |
| `deadline` | ✅ |
| `allow_late` | ✅ |
| `target_year` | ❌ Immutable |
| `target_sections` | ❌ Immutable |
| `target_groups` | ❌ Immutable |
| `subject` | ❌ Immutable |

**Response 200:**
```json
{
  "id": 1,
  "title": "Updated Title",
  "description": "Updated description",
  "subject": {
    "id": 1,
    "name": "Algorithms and Data Structures",
    "code": "ASD101"
  },
  "target_year": "3CS",
  "target_sections": ["SIL"],
  "target_groups": [],
  "deadline": "2026-06-01T23:59:00Z",
  "allow_late": true,
  "is_open": true,
  "professor_name": "John Doe",
  "submission_count": 5,
  "professor": {
    "email": "nt_boudjemaa@esi.dz",
    "first_name": "John",
    "last_name": "Doe"
  },
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T01:00:00Z"
}
```

**Response 400 — Immutable field:**
```json
{ "detail": "Fields target_year, target_sections, target_groups and subject cannot be updated." }
```

**Response 400 — Disallowed field:**
```json
{ "detail": "Only title, description, deadline and allow_late can be updated." }
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

### 5. Delete Assignment
**DELETE** `/assignments/<id>/`

**Auth:** Required — Creating professor only

**Response 204:** No content

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

**Response 404:**
```json
{ "detail": "No Assignment matches the given query." }
```

---

## Notes

- All endpoints require `Content-Type: application/json`
- List endpoint is paginated — **20 items per page**
- `subject` is returned as a nested object `{ id, name, code }` — send only the `id` integer when creating
- `is_open` is a computed field — `true` if the deadline has not passed yet
- `professor_name` is a computed field — full name of the creating professor
- `submission_count` is a computed field — total number of submissions for this assignment
- `professor` field in responses is auto-set from the authenticated user — do not send it in requests
- Student targeting is based on `target_year`, `target_sections`, and `target_groups` matched against the student's ESI profile
- Deleting an assignment also deletes all its associated files from Google Cloud Storage
- `target_sections` and `target_groups` are mutually exclusive — only one can be set per assignment
- `deadline` must be in the future when creating — past deadlines return 400
