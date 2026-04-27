# Forum API Documentation

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
| `student` | Read, post questions, post answers, vote, accept answers |
| `professor` | Read only cannot post, vote, or accept answers |

---

## Question Endpoints

### 1. List Questions
**GET** `/forum/questions/`

**Auth:** Required

**Query Parameters:**
| Param | Description | Example |
|-------|-------------|---------|
| `tag` | Filter by tag (case-insensitive) | `?tag=algorithms` |
| `search` | Search by title | `?search=quicksort` |
| `author` | Filter by author email | `?author=om_kessab@esi.dz` |
| `ordering` | Sort order | `?ordering=newest\|top\|unanswered` |
| `page` | Page number | `?page=2` |

**Response 200:**
```json
{
  "count": 10,
  "next": "http://localhost:8000/api/forum/questions/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "How does quicksort work?",
      "tags": ["algorithms", "sorting"],
      "author_name": "Kessab Mohamed Nour",
      "answer_count": 3,
      "vote_score": 5,
      "has_accepted_answer": true,
      "view_count": 42,
      "created_at": "2026-01-01T10:00:00Z"
    }
  ]
}
```

**Response 401:**
```json
{ "detail": "Authentication credentials were not provided." }
```

---

### 2. Create Question
**POST** `/forum/questions/`

**Auth:** Required — Student only

**Request:**
```json
{
  "title": "How does quicksort work?",
  "body": "I am trying to understand quicksort...",
  "code_snippet": "def quicksort(arr): ...",
  "code_language": "python",
  "tags": ["algorithms", "sorting"]
}
```

**Field Reference:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | Question title (not blank) |
| `body` | string | ✅ | Question body (not blank) |
| `code_snippet` | string | ❌ | Optional code snippet |
| `code_language` | string | ❌ | Language of the code snippet |
| `tags` | array | ❌ | Max 5 tags, each max 50 characters |

**Response 201:**
```json
{
  "id": 1,
  "title": "How does quicksort work?",
  "tags": ["algorithms", "sorting"],
  "author_name": "Kessab Mohamed Nour",
  "author_email": "om_kessab@esi.dz",
  "answer_count": 0,
  "vote_score": 0,
  "has_accepted_answer": false,
  "view_count": 0,
  "created_at": "2026-01-01T10:00:00Z",
  "body": "I am trying to understand quicksort...",
  "code_snippet": "def quicksort(arr): ...",
  "code_language": "python",
  "is_closed": false,
  "can_accept_answer": false,
  "answers": []
}
```

**Response 400 — Blank title:**
```json
{ "title": ["Title cannot be blank."] }
```

**Response 400 — Too many tags:**
```json
{ "tags": ["Maximum 5 tags allowed."] }
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

### 3. Get Single Question
**GET** `/forum/questions/<id>/`

**Auth:** Required

> ℹ️ `view_count` is incremented automatically on every GET request.

**Response 200:**
```json
{
  "id": 1,
  "title": "How does quicksort work?",
  "tags": ["algorithms", "sorting"],
  "author_name": "Kessab Mohamed Nour",
  "author_email": "om_kessab@esi.dz",
  "answer_count": 1,
  "vote_score": 5,
  "has_accepted_answer": false,
  "view_count": 43,
  "created_at": "2026-01-01T10:00:00Z",
  "body": "I am trying to understand quicksort...",
  "code_snippet": "def quicksort(arr): ...",
  "code_language": "python",
  "is_closed": false,
  "can_accept_answer": false,
  "answers": [
    {
      "id": 1,
      "question": 1,
      "parent": null,
      "author_name": "Kessab Mohamed Nour",
      "author_email": "om_kessab@esi.dz",
      "body": "Quicksort works by...",
      "code_snippet": "",
      "code_language": "",
      "is_accepted": false,
      "vote_score": 2,
      "user_vote": null,
      "reply_count": 0,
      "replies": [],
      "created_at": "2026-01-01T11:00:00Z",
      "updated_at": "2026-01-01T11:00:00Z"
    }
  ]
}
```

**Response 404:**
```json
{ "detail": "No Question matches the given query." }
```

---

### 4. Update Question
**PATCH** `/forum/questions/<id>/`

**Auth:** Required — Question author only (student)

**Updatable fields only:**
```json
{
  "title": "Updated title",
  "body": "Updated body",
  "code_snippet": "updated code",
  "code_language": "java",
  "tags": ["algorithms"],
  "is_closed": true
}
```

**Response 200:**
```json
{
  "id": 1,
  "title": "Updated title",
  "tags": ["algorithms"],
  "author_name": "Kessab Mohamed Nour",
  "author_email": "om_kessab@esi.dz",
  "answer_count": 1,
  "vote_score": 5,
  "has_accepted_answer": false,
  "view_count": 43,
  "created_at": "2026-01-01T10:00:00Z",
  "body": "Updated body",
  "code_snippet": "updated code",
  "code_language": "java",
  "is_closed": true,
  "can_accept_answer": false,
  "answers": []
}
```

**Response 400 — Has accepted answer:**
```json
{ "detail": "Cannot edit a question that has an accepted answer." }
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

### 5. Delete Question
**DELETE** `/forum/questions/<id>/`

**Auth:** Required — Question author only (student)

**Response 204:** No content

**Response 400 — Has accepted answer:**
```json
{ "detail": "Cannot delete a question that has an accepted answer." }
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

## Answer Endpoints

### 6. Post Answer or Reply
**POST** `/forum/questions/<id>/answers/`

**Auth:** Required — Student only

**Request:**
```json
{
  "body": "Quicksort works by selecting a pivot...",
  "code_snippet": "def quicksort(arr): ...",
  "code_language": "python",
  "parent_id": null
}
```

**Field Reference:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `body` | string | ✅ | Answer body (not blank) |
| `code_snippet` | string | ❌ | Optional code snippet |
| `code_language` | string | ❌ | Language of the code snippet |
| `parent_id` | integer | ❌ | null for top-level answer, Answer ID for reply |

**Response 201:**
```json
{
  "id": 1,
  "question": 1,
  "parent": null,
  "author_name": "Kessab Mohamed Nour",
  "author_email": "om_kessab@esi.dz",
  "body": "Quicksort works by selecting a pivot...",
  "code_snippet": "def quicksort(arr): ...",
  "code_language": "python",
  "is_accepted": false,
  "vote_score": 0,
  "user_vote": null,
  "reply_count": 0,
  "replies": [],
  "created_at": "2026-01-01T11:00:00Z",
  "updated_at": "2026-01-01T11:00:00Z"
}
```

**Response 400 — Question is closed:**
```json
{ "detail": "This question is closed." }
```

**Response 400 — Already replied:**
```json
{ "detail": "You have already replied to this answer." }
```

**Response 400 — Parent from different question:**
```json
{ "detail": "Parent answer does not belong to this question." }
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

### 7. Update Answer
**PATCH** `/forum/questions/<qid>/answers/<aid>/`

**Auth:** Required — Answer author only (student)

**Updatable fields only:**
```json
{
  "body": "Updated answer body",
  "code_snippet": "updated code",
  "code_language": "java"
}
```

**Response 200:**
```json
{
  "id": 1,
  "question": 1,
  "parent": null,
  "author_name": "Kessab Mohamed Nour",
  "author_email": "om_kessab@esi.dz",
  "body": "Updated answer body",
  "code_snippet": "updated code",
  "code_language": "java",
  "is_accepted": false,
  "vote_score": 2,
  "user_vote": null,
  "reply_count": 0,
  "replies": [],
  "created_at": "2026-01-01T11:00:00Z",
  "updated_at": "2026-01-01T12:00:00Z"
}
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

### 8. Delete Answer
**DELETE** `/forum/questions/<qid>/answers/<aid>/`

**Auth:** Required — Answer author only (student)

**Response 204:** No content

**Response 400 — Accepted answer:**
```json
{ "detail": "Cannot delete the accepted answer." }
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

### 9. Accept Answer
**POST** `/forum/questions/<qid>/answers/<aid>/accept/`

**Auth:** Required — Question author only (student)

**Response 200:**
```json
{
  "id": 1,
  "question": 1,
  "parent": null,
  "author_name": "Kessab Mohamed Nour",
  "author_email": "om_kessab@esi.dz",
  "body": "Quicksort works by selecting a pivot...",
  "code_snippet": "",
  "code_language": "",
  "is_accepted": true,
  "vote_score": 5,
  "user_vote": null,
  "reply_count": 0,
  "replies": [],
  "created_at": "2026-01-01T11:00:00Z",
  "updated_at": "2026-01-01T12:00:00Z"
}
```

**Response 400 — Too early:**
```json
{ "detail": "You can only accept an answer 24 hours after posting the question." }
```

**Response 400 — Already accepted:**
```json
{ "detail": "This question already has an accepted answer." }
```

**Response 400 — Reply:**
```json
{ "detail": "Only top-level answers can be accepted." }
```

**Response 403:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

## Vote Endpoints

### 10. Vote on Question
**POST** `/forum/questions/<id>/vote/`

**Auth:** Required — Student only

**Request:**
```json
{ "value": 1 }
```

**Vote Values:**
| Value | Description |
|-------|-------------|
| `1` | Upvote |
| `-1` | Downvote |

> ℹ️ Sending the same vote again toggles it off. Sending the opposite vote updates it.

**Response 200:**
```json
{ "vote_score": 6 }
```

**Response 400 — Invalid value:**
```json
{ "detail": "Vote value must be 1 or -1." }
```

**Response 403 — Own content:**
```json
{ "detail": "You cannot vote on your own content." }
```

**Response 403 — Not a student:**
```json
{ "detail": "You do not have permission to perform this action." }
```

---

### 11. Vote on Answer
**POST** `/forum/questions/<qid>/answers/<aid>/vote/`

**Auth:** Required — Student only

Same request and response as question vote.

---

## Notes
- All endpoints require `Content-Type: application/json`
- List endpoint is paginated — **20 items per page**
- `view_count` is incremented automatically on every GET request to a single question
- Questions cannot be edited or deleted once they have an accepted answer
- Answers cannot be deleted if they are the accepted answer
- Only top-level answers (not replies) can be accepted
- An answer can only be accepted 24 hours after the question was posted
- Professors can read all content but cannot post, vote, or accept answers
- `user_vote` in answer responses returns `1`, `-1`, or `null` based on the authenticated user's vote