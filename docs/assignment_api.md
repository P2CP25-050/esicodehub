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