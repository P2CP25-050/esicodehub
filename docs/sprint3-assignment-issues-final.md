# Sprint 3 — Assignment System Issues (Final)

---

## Architecture Notes (Read Before Starting)

### Assignment Targeting Logic
A professor creates an assignment targeting:
- `target_year` — required (1CP, 2CP, 1CS, 2CS, 3CS)
- `target_sections` — optional list (e.g. ["A", "B"] or ["SIL", "SIQ"])
- `target_groups` — optional list (e.g. [1, 2, 3])

**Sections and groups are mutually exclusive** — if sections are set, groups must be empty, and vice versa. If neither is set, the entire year is targeted.

Targeting logic:
- Year only → all students in that year
- Year + sections → students in those sections (any group)
- Year + groups → students in those groups (any section)

When checking if a student is targeted:
```python
def student_is_targeted(assignment, esi_student):
    # Year must always match
    if assignment.target_year != esi_student.study_year:
        return False
    # If sections specified, student's section must be in the list
    if assignment.target_sections:
        return esi_student.section in assignment.target_sections
    # If groups specified, student's group must be in the list
    if assignment.target_groups:
        return esi_student.group in assignment.target_groups
    # No section/group filter → whole year is targeted
    return True
```

### Multiple Professors Can Review
- Any professor can review any submission for any assignment (not restricted to the creating professor)
- One review per professor per submission (`unique_together = ['submission', 'professor']`)
- Reviews are fully replaceable — a professor can redo their review and it replaces the old one
- When browsing submissions to review, a professor uses a group filter to see one group at a time

### GCS Path Structure and Resubmitting
```
assignments/
  {assignment_id}/
    {student_id}/
      {submission_id}/        ← permanent, never changes
        main.py
        utils/helpers.py
```

`submission_id` is permanent because `unique_together = ['assignment', 'student']` ensures one submission record per student per assignment. On resubmission:
- Keep same `AssignmentSubmission` record (same ID, same GCS prefix)
- Delete old GCS files at that prefix
- Delete old `AssignmentSubmissionFile` records
- Upload new files to same GCS prefix
- Create new `AssignmentSubmissionFile` records
- Update `submitted_at` and `is_late`

### Submission Time and Late Flagging
- `submitted_at` auto-updates on every resubmission (`auto_now=True`)
- `is_late` is set to `True` if submitted after `assignment.deadline`
- `is_late` is shown as a visible badge in the professor's submissions list

---

## CARRY-OVER FROM SPRINT 2

---

### Issue 0: [Frontend] Edit Submission Page (Carry-over)

**Labels:** `frontend`, `ui`, `carry-over`
**Branch:** `frontend/edit-submission-page`

#### Description
Implement the page for editing an existing personal submission at `pages/submissions/[id]/edit.tsx`. Must be finished in the first 2 days of Sprint 3 before any new work starts.

#### Technical Notes

**Two tabs:**

Tab 1 — Edit metadata:
- Same fields as upload page, pre-populated with current data
- Save button calls `updateSubmission()` from submissions service
- Show success message on save without navigating away

Tab 2 — Manage files:
- List all current files with file name, relative path, size, delete button
- Delete calls `deleteFile()` with confirmation
- Add new files section — same drag and drop as upload page
- New files uploaded via `uploadFiles()`

**Access control:**
- Wrap with `ProtectedRoute`
- On load, verify `user?.email === submission.owner.email`
- If not owner → redirect to `/submissions/<id>`

---

## BACKEND ISSUES

---

### Issue 1: [Backend] Assignment and Related Models

**Labels:** `backend`, `models`
**Branch:** `backend/assignment-models`

#### Description
Implement all database models for the assignment system in a new `assignment_submissions` Django app.

#### Technical Notes

**Create the app:**
```bash
docker-compose exec backend python manage.py startapp assignment_submissions
mv backend/assignment_submissions backend/apps/assignment_submissions
```

Add `apps.assignment_submissions` to `INSTALLED_APPS`. Make sure `apps.py` uses `name = 'apps.assignment_submissions'`.

**`Assignment` model fields:**
- `professor` — ForeignKey to `settings.AUTH_USER_MODEL`, `related_name='assignments'`, on_delete=CASCADE
- `subject` — ForeignKey to `accounts.Subject`, on_delete=PROTECT
- `title` — CharField(255)
- `description` — TextField(blank=True)
- `target_year` — CharField(3), choices: `1CP`, `2CP`, `1CS`, `2CS`, `3CS`
- `target_sections` — JSONField(default=list, blank=True) — e.g. `["A", "B"]` or `["SIL"]` or `[]`
- `target_groups` — JSONField(default=list, blank=True) — e.g. `[1, 2]` or `[]`
- `deadline` — DateTimeField
- `allow_late` — BooleanField, default=False
- `created_at` — auto DateTimeField
- `updated_at` — auto DateTimeField
- `db_table = 'assignments'`
- `ordering = ['-created_at']`

Add model method:
```python
def is_open_for_submission(self):
    from django.utils import timezone
    if timezone.now() <= self.deadline:
        return True
    return self.allow_late
```

Add `clean()` validation — sections and groups are mutually exclusive:
```python
from django.core.exceptions import ValidationError

def clean(self):
    if self.target_sections and self.target_groups:
        raise ValidationError(
            'target_sections and target_groups are mutually exclusive. Set only one.'
        )
```

**`AssignmentSubmission` model fields:**
- `assignment` — ForeignKey to `Assignment`, `related_name='submissions'`, on_delete=CASCADE
- `student` — ForeignKey to `settings.AUTH_USER_MODEL`, `related_name='assignment_submissions'`, on_delete=CASCADE
- `gcs_prefix` — CharField(500)
- `submitted_at` — DateTimeField, `auto_now=True` — updates on every resubmission
- `is_late` — BooleanField, default=False
- `created_at` — DateTimeField, `auto_now_add=True` — first submission time, never changes
- `db_table = 'assignment_submissions'`
- `unique_together = [['assignment', 'student']]`

Add static methods:
- `build_gcs_prefix(assignment_id, student_id, submission_id)` → `assignments/{assignment_id}/{student_id}/{submission_id}/`
- `build_file_gcs_path(assignment_id, student_id, submission_id, file_path)` → `assignments/{assignment_id}/{student_id}/{submission_id}/{file_path}`

**`AssignmentSubmissionFile` model fields:**
- `submission` — ForeignKey to `AssignmentSubmission`, `related_name='files'`, on_delete=CASCADE
- `file_name` — CharField(255)
- `file_path` — CharField(500)
- `gcs_path` — CharField(1000)
- `file_size` — PositiveIntegerField
- `created_at` — auto DateTimeField
- `db_table = 'assignment_submission_files'`

**`SubmissionReview` model fields:**
- `submission` — ForeignKey to `AssignmentSubmission`, `related_name='reviews'`, on_delete=CASCADE
- `professor` — ForeignKey to `settings.AUTH_USER_MODEL`, `related_name='reviews_given'`, on_delete=CASCADE
- `general_comment` — TextField(blank=True)
- `grade` — DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
- `created_at` — auto DateTimeField
- `updated_at` — auto DateTimeField
- `db_table = 'submission_reviews'`
- `unique_together = [['submission', 'professor']]` — one review per professor per submission

Note: Changed from `OneToOneField` to `ForeignKey` + `unique_together` because multiple professors can review the same submission.

**`ReviewComment` model fields:**
- `review` — ForeignKey to `SubmissionReview`, `related_name='comments'`, on_delete=CASCADE
- `file` — ForeignKey to `AssignmentSubmissionFile`, on_delete=CASCADE
- `line_number` — PositiveIntegerField
- `content` — TextField
- `created_at` — auto DateTimeField
- `db_table = 'review_comments'`

**Register all models in admin. Run migrations.**

#### Related Issues
- Blocks: Issues 2, 3, 4

---

### Issue 2: [Backend] Assignment Serializers

**Labels:** `backend`, `serializers`
**Branch:** `backend/assignment-serializers`

#### Description
Implement DRF serializers for all assignment models in `apps/assignment_submissions/serializers.py`.

#### Technical Notes

**`AssignmentListSerializer`:**
- Fields: `id`, `title`, `description`, `subject` (nested: `id`, `name`, `code`), `target_year`, `target_sections`, `target_groups`, `deadline`, `allow_late`
- Computed: `is_open` (from `is_open_for_submission()`), `professor_name`, `submission_count`

**`AssignmentDetailSerializer`:**
- All list fields plus `created_at`, `updated_at`
- Nested professor: `email`, `first_name`, `last_name`

**`AssignmentCreateSerializer`:**
- Fields: `title`, `description`, `subject`, `target_year`, `target_sections`, `target_groups`, `deadline`, `allow_late`
- Validate deadline is in the future on creation
- Validate `target_sections` and `target_groups` are not both non-empty (mutually exclusive)

**`AssignmentSubmissionFileSerializer`:**
- Fields: `id`, `file_name`, `file_path`, `file_size`, `created_at`

**`AssignmentSubmissionListSerializer`:**
- Fields: `id`, `student_name` (computed), `student_email`, `submitted_at`, `is_late`, `file_count` (computed), `has_reviews` (True if any reviews exist)

**`AssignmentSubmissionDetailSerializer`:**
- All list fields plus nested `files` and nested `reviews` (list of all reviews from all professors)

**`ReviewCommentSerializer`:**
- Fields: `id`, `file` (id), `line_number`, `content`, `created_at`

**`SubmissionReviewSerializer`:**
- Fields: `id`, `professor_name` (computed), `general_comment`, `grade`, `created_at`, `updated_at`, nested `comments`

**`ReviewCreateSerializer`:**
- Fields: `general_comment`, `grade`, `comments` (list of `{file_id, line_number, content}`)

#### Related Issues
- Depends on: Issue 1
- Blocks: Issues 3, 4

---

### Issue 3: [Backend] Assignment CRUD API

**Labels:** `backend`, `api`
**Branch:** `backend/assignment-api`

#### Description
Implement REST API endpoints for assignment management. Professors create and manage assignments. Students see only assignments targeted at them.

#### Technical Notes

**Endpoints:**

`GET /api/assignments/`
- Auth required
- Professors: all assignments they created
- Students: only targeted assignments (check via `student_is_targeted()` helper using `EsiStudent` lookup by `user.school_id`)
- Optional query params for professor: `?group=1` to filter by group
- Return `AssignmentListSerializer`, paginated 20 per page

`POST /api/assignments/`
- Professor only — return 403 if `request.user.role != 'professor'`
- Validate `target_sections` and `target_groups` are mutually exclusive
- Return `AssignmentDetailSerializer` with 201

`GET /api/assignments/<id>/`
- Professor (any professor, not just creator): full detail
- Targeted student: full detail
- Anyone else: 403

`PATCH /api/assignments/<id>/`
- Creating professor only
- Allowed fields: `title`, `description`, `deadline`, `allow_late`
- Block changes to: `target_year`, `target_sections`, `target_groups`, `subject`
- Return updated `AssignmentDetailSerializer`

`DELETE /api/assignments/<id>/`
- Creating professor only
- Delete all GCS files under `assignments/{assignment_id}/`
- Return 204

**Wire up in `apps/assignment_submissions/urls.py`** and include in `config/urls.py` under `api/assignments/`.

#### Related Issues
- Depends on: Issues 1, 2
- Blocks: Issue 4

---

### Issue 4: [Backend] Assignment Submission and Review API

**Labels:** `backend`, `api`
**Branch:** `backend/assignment-submission-api`

#### Description
Implement endpoints for student submission and multi-professor review with full replace-on-edit behavior.

#### Technical Notes

**Student endpoints:**

`POST /api/assignments/<id>/submit/`
- Student only
- Check student is targeted
- Check `assignment.is_open_for_submission()`
- Accept `multipart/form-data` with `files` and `file_paths`
- Validate files: size ≤ 10MB each, total ≤ 50MB, MIME check, path traversal check
- Resubmission logic (using `update_or_create` on `AssignmentSubmission`):
  - If existing submission: delete old GCS files, delete old file records, upload new files, create new records, set `is_late` if past deadline
  - If new: create submission with empty prefix, build prefix after getting ID, upload files, set `is_late`
- Wrap all DB operations in `transaction.atomic()`
- Return `AssignmentSubmissionDetailSerializer` with 201

`GET /api/assignments/<id>/my-submission/`
- Student only — returns their submission or 404

**Professor endpoints:**

`GET /api/assignments/<id>/submissions/`
- Any professor (not just creator)
- Optional `?group=1` filter to see one group at a time
- Returns `AssignmentSubmissionListSerializer`, paginated

`GET /api/assignments/<id>/submissions/<submission_id>/`
- Any professor
- Full detail with files and all reviews

`GET /api/assignments/<id>/submissions/<submission_id>/files/<file_id>/content/`
- Any professor
- Returns plain text via `HttpResponse(content, content_type='text/plain; charset=utf-8')`
- Catch `UnicodeDecodeError` → 400

`POST /api/assignments/<id>/submissions/<submission_id>/review/`
- Any professor
- Creates or fully replaces this professor's review of this submission
- Delete all existing `ReviewComment` records for this professor's review if it exists
- Update or create `SubmissionReview` record
- Create new `ReviewComment` records from the `comments` list
- Body: `{ general_comment, grade, comments: [{file_id, line_number, content}] }`
- All in `transaction.atomic()`
- Return `SubmissionReviewSerializer` with 201

`GET /api/assignments/<id>/submissions/<submission_id>/reviews/`
- Any professor or the submitting student
- Returns list of all reviews for this submission
- Student sees all professor reviews on their submission

#### Related Issues
- Depends on: Issues 1, 2, 3
- Blocks: Frontend Issues 6, 7, 8, 9

---

### Issue 5: [Backend] Subjects List Endpoint

**Labels:** `backend`, `api`
**Branch:** `backend/subjects-api`

#### Description
Add a simple public endpoint to list all subjects and seed initial subject data.

#### Technical Notes

Add to `apps/accounts/views.py`:
```python
@api_view(['GET'])
def subject_list(request):
    from .models import Subject
    subjects = Subject.objects.all().order_by('code')
    data = [{'id': s.id, 'name': s.name, 'code': s.code} for s in subjects]
    return Response(data)
```

Add to `apps/accounts/urls.py` and include in `config/urls.py`:
```
GET /api/subjects/
```

**Seed subjects** at `apps/accounts/fixtures/subjects.json`:
```json
[
  {"model": "accounts.subject", "pk": 1, "fields": {"name": "Algorithmique et Structure de Données", "code": "ASD"}},
  {"model": "accounts.subject", "pk": 2, "fields": {"name": "Systèmes d'Exploitation", "code": "SE"}},
  {"model": "accounts.subject", "pk": 3, "fields": {"name": "Bases de Données", "code": "BD"}},
  {"model": "accounts.subject", "pk": 4, "fields": {"name": "Programmation Orientée Objet", "code": "POO"}},
  {"model": "accounts.subject", "pk": 5, "fields": {"name": "Réseaux Informatiques", "code": "RI"}},
  {"model": "accounts.subject", "pk": 6, "fields": {"name": "Analyse Numérique", "code": "AN"}},
  {"model": "accounts.subject", "pk": 7, "fields": {"name": "Logique Mathématique", "code": "LM"}},
  {"model": "accounts.subject", "pk": 8, "fields": {"name": "Programmation Web", "code": "PW"}}
]
```

Update `entrypoint.sh` to auto-load subjects if empty.

#### Related Issues
- Blocks: Frontend Issue 8

---

## FRONTEND ISSUES

---

### Issue 6: [Frontend] Assignment Service Layer

**Labels:** `frontend`, `api`
**Branch:** `frontend/assignment-api-service`

#### Description
Create the TypeScript service layer for all assignment-related API calls.

#### Technical Notes

Structure:
```
services/assignments/
  index.ts
  assignments.types.ts
  assignments.api.ts
```

**Key interfaces — field names must match backend exactly:**

```typescript
export interface Assignment {
  id: number;
  title: string;
  description: string;
  subject: { id: number; name: string; code: string };
  target_year: string;
  target_sections: string[];   // [] means not filtered by section
  target_groups: number[];     // [] means not filtered by group
  deadline: string;
  allow_late: boolean;
  is_open: boolean;
  professor_name: string;
  submission_count: number;
  created_at: string;
  updated_at: string;
}

export interface AssignmentCreatePayload {
  title: string;
  description?: string;
  subject: number;
  target_year: string;
  target_sections?: string[];
  target_groups?: number[];
  deadline: string;
  allow_late?: boolean;
}

export interface ReviewComment {
  id: number;
  file: number;
  line_number: number;
  content: string;
  created_at: string;
}

export interface SubmissionReview {
  id: number;
  professor_name: string;
  general_comment: string;
  grade: number | null;
  comments: ReviewComment[];
  created_at: string;
  updated_at: string;
}

export interface AssignmentSubmission {
  id: number;
  student_name: string;
  student_email: string;
  submitted_at: string;
  is_late: boolean;
  file_count: number;
  has_reviews: boolean;
  files?: AssignmentSubmissionFile[];
  reviews?: SubmissionReview[];
}

export interface ReviewCreatePayload {
  general_comment: string;
  grade?: number | null;
  comments: { file_id: number; line_number: number; content: string }[];
}
```

**Functions:**
- `listAssignments(params?)` — GET `/assignments/` (optional `?group=` for professors)
- `getAssignment(id)` — GET `/assignments/<id>/`
- `createAssignment(data)` — POST `/assignments/`
- `updateAssignment(id, data)` — PATCH `/assignments/<id>/`
- `deleteAssignment(id)` — DELETE `/assignments/<id>/`
- `submitToAssignment(id, files, filePaths)` — POST multipart `/assignments/<id>/submit/`
- `getMySubmission(assignmentId)` — GET `/assignments/<id>/my-submission/`
- `getSubmissions(assignmentId, group?)` — GET `/assignments/<id>/submissions/`
- `getSubmission(assignmentId, submissionId)` — GET detail
- `getSubmissionFileContent(assignmentId, submissionId, fileId)` — GET plain text
- `createOrReplaceReview(assignmentId, submissionId, data)` — POST review
- `getReviews(assignmentId, submissionId)` — GET all reviews
- `listSubjects()` — GET `/subjects/`

#### Related Issues
- Blocks: Issues 7, 8, 9, 10

---

### Issue 7: [Frontend] Assignments List Page

**Labels:** `frontend`, `ui`
**Branch:** `frontend/assignments-list-page`

#### Description
Implement the assignments list page at `pages/assignments/index.tsx`. Adapts by role.

#### Technical Notes

**For students:**
- Cards: subject code badge, title, professor name, deadline (red if past, green if open), "Submitted" badge if submitted
- Empty state if no assignments targeted at them
- Click → `/assignments/<id>`

**For professors:**
- Cards: subject badge, title, targeting summary (e.g. "2CP • All sections • Groups 1, 2"), deadline, submission count
- Group filter dropdown — professor selects one group to focus on
- "Create Assignment" button → `/assignments/new`
- Click → `/assignments/<id>`

**Targeting summary display:**
```typescript
const getTargetSummary = (assignment: Assignment): string => {
  let summary = assignment.target_year;
  if (assignment.target_sections.length > 0) {
    summary += ` • Sections ${assignment.target_sections.join(', ')}`;
  } else if (assignment.target_groups.length > 0) {
    summary += ` • Groups ${assignment.target_groups.join(', ')}`;
  } else {
    summary += ' • All students';
  }
  return summary;
};
```

**Wrap with `ProtectedRoute`.**

#### Related Issues
- Depends on: Issue 6

---

### Issue 8: [Frontend] Create Assignment Page

**Labels:** `frontend`, `ui`
**Branch:** `frontend/create-assignment-page`

#### Description
Implement the professor assignment creation page at `pages/assignments/new.tsx`.

#### Technical Notes

**Form fields:**
- Subject — dropdown from `listSubjects()`
- Title — required text input
- Description — optional textarea
- Target year — dropdown: 1CP, 2CP, 1CS, 2CS, 3CS
- Target sections — multi-select or tag input (e.g. A, B, C or SIQ, SIT, SIL, SID)
- Target groups — multi-select number input (1, 2, 3...)
- **Sections and groups are mutually exclusive** — selecting a section clears groups and disables the groups input, and vice versa
- Deadline — datetime-local input
- Allow late submissions — toggle

**Mutually exclusive UI logic:**
```typescript
const handleSectionChange = (sections: string[]) => {
  setTargetSections(sections);
  if (sections.length > 0) setTargetGroups([]); // clear groups
};

const handleGroupChange = (groups: number[]) => {
  setTargetGroups(groups);
  if (groups.length > 0) setTargetSections([]); // clear sections
};
```

**Client-side validation:**
- Title required
- Subject required
- Year required
- Deadline must be in the future
- Sections and groups cannot both be set (enforce in UI, also caught by backend)

**On submit:**
- Call `createAssignment()`
- On success → redirect to `/assignments/<id>`

**Access control:**
- Wrap with `ProtectedRoute allowedRole="professor"`

#### Related Issues
- Depends on: Issues 5, 6

---

### Issue 9: [Frontend] Assignment Detail Page

**Labels:** `frontend`, `ui`
**Branch:** `frontend/assignment-detail-page`

#### Description
Implement the assignment detail page at `pages/assignments/[id].tsx`. Different content per role.

#### Technical Notes

**For students:**
- Assignment info: title, subject, description, targeting summary, deadline, professor name
- Deadline badge: green "Open", orange "Open (Late)", red "Closed"
- Submission section:
  - Not submitted + open: drag and drop upload, submit button
  - Submitted: list of submitted files, resubmit button (shows warning "This will replace your previous submission")
  - Submitted + late: show "Late submission" badge on the file list
  - Closed: "Submission closed" banner, hide upload
- Reviews section (shown if any reviews exist):
  - For each review: professor name, grade, general comment, count of line comments
  - Note: "View full line comments in the review page"

**For professors:**
- Assignment info with Edit button (for creating professor only)
- Group filter dropdown to narrow the submissions list
- Submissions table:
  - Columns: student name, submitted at, late badge, file count, reviews count, "Review" button
  - "Review" → `/assignments/<id>/submissions/<submission_id>`
- Late submissions shown with orange "Late" badge

**Wrap with `ProtectedRoute`.**

#### Related Issues
- Depends on: Issue 6
- Blocks: Issue 10

---

### Issue 10: [Frontend] Submission Review Page

**Labels:** `frontend`, `ui`
**Branch:** `frontend/submission-review-page`

#### Description
Implement the review page at `pages/assignments/[id]/submissions/[submissionId].tsx`. Multiple professors can each have their own review.

#### Technical Notes

**Page layout:**
```
┌──────────────────────────────────────────────┐
│ ← Back  Student name • Submitted at • Late?  │
├──────────────┬───────────────────────────────┤
│  File tree   │  Monaco Editor (read-only)    │
│              │                               │
│              │  Lines with comments:         │
│              │  highlighted in yellow        │
└──────────────┴───────────────────────────────┘
┌──────────────────────────────────────────────┐
│ My Review  (professor sees their own review) │
│ General comment: [textarea]                  │
│ Grade: [number input] / 20                   │
│                                              │
│ Pending line comments:                       │
│  [File: main.py  Line: 5]  "comment"  [✕]   │
│  [+ Add line comment]                        │
│                                              │
│ [Save Review]  (replaces previous review)    │
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│ Other Reviews  (from other professors)       │
│ Prof. X — Grade: 15/20                       │
│ "General comment..."                         │
│ 3 line comments                              │
└──────────────────────────────────────────────┘
```

**On mount:**
- Fetch submission detail with files
- Fetch all reviews via `getReviews()`
- Separate the current professor's review from others
- Pre-populate form with current professor's existing review if it exists

**Monaco Editor:**
- Read-only, dark theme
- Lines that have comments (from current professor's review) highlighted in yellow
- On line number click or hover "+" button → inline form to add comment

**Line comment form:**
- File auto-selected (current file in editor)
- Line number auto-filled
- Professor types content → "Add" → added to local pending list
- Pending comments shown below the editor
- "✕" button removes a pending comment

**Save Review:**
- Calls `createOrReplaceReview()` — always a full replace, not a patch
- If professor had a previous review, it is completely replaced
- Show success toast on save
- Refresh reviews after save

**Access control:**
- Wrap with `ProtectedRoute allowedRole="professor"`
