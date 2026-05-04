# Additional Sprint Issues

---

## Issue B5: [Backend] In-App Notification System

**Labels:** `backend`, `notifications`
**Branch:** `backend/notifications`
**Assigned to:** Backend Dev 1 or 2
**Estimated time:** 3 hours

#### Description
Implement a `Notification` model and the API endpoints to list and mark
notifications as read. Notifications are created server-side by signals
or service functions whenever a relevant event occurs. No WebSockets —
the frontend polls for new notifications on a short interval.

#### Technical Notes

**Model — create `apps/notifications/models.py`:**

```python
class Notification(models.Model):
    class Type(models.TextChoices):
        FORUM_ANSWER        = 'forum_answer',        'Someone answered your question'
        FORUM_COMMENT       = 'forum_comment',       'Someone replied to your answer'
        ASSIGNMENT_CREATED  = 'assignment_created',  'A new assignment was posted'
        ASSIGNMENT_GRADED   = 'assignment_graded',   'Your submission was graded'
        ASSIGNMENT_REVIEWED = 'assignment_reviewed', 'Your submission received a review'

    recipient   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                    related_name='notifications')
    type        = models.CharField(max_length=32, choices=Type.choices)
    title       = models.CharField(max_length=255)
    body        = models.CharField(max_length=500, blank=True)
    link        = models.CharField(max_length=255, blank=True)  # e.g. /forum/12
    is_read     = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
```

**Endpoints — `apps/notifications/views.py`:**

```
GET  /api/notifications/          — list latest 30 notifications for current user
PATCH /api/notifications/read/    — mark all as read (bulk)
PATCH /api/notifications/{id}/read/ — mark one as read
```

**Trigger functions — create `apps/notifications/service.py`:**
Keep these simple so any app can import and call them:

```python
def notify(recipient, type, title, body='', link=''):
    Notification.objects.create(
        recipient=recipient, type=type,
        title=title, body=body, link=link
    )
```

**Wire up triggers using Django signals in each app:**

```python
# apps/forum/signals.py
from django.db.models.signals import post_save
from apps.notifications.service import notify

@receiver(post_save, sender=Answer)
def notify_on_answer(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.parent is None:
        # Top-level answer → notify question author
        if instance.author != instance.question.author:
            notify(
                recipient=instance.question.author,
                type='forum_answer',
                title=f'{instance.author.first_name} answered your question',
                body=instance.question.title[:100],
                link=f'/forum/{instance.question.id}',
            )
    else:
        # Reply → notify parent answer author
        if instance.author != instance.parent.author:
            notify(
                recipient=instance.parent.author,
                type='forum_comment',
                title=f'{instance.author.first_name} replied to your answer',
                body=instance.question.title[:100],
                link=f'/forum/{instance.question.id}',
            )

# apps/assignments/signals.py
@receiver(post_save, sender=Assignment)
def notify_on_assignment_created(sender, instance, created, **kwargs):
    if not created:
        return
    # Notify all targeted students — batch create, not one query per student
    targeted_students = instance.get_targeted_students()  # your existing method
    Notification.objects.bulk_create([
        Notification(
            recipient=student,
            type='assignment_created',
            title=f'New assignment: {instance.title}',
            body=f'Due {instance.due_date.strftime("%b %d")}',
            link=f'/assignments/{instance.id}',
        )
        for student in targeted_students
    ])

@receiver(post_save, sender=SubmissionReview)
def notify_on_review(sender, instance, created, **kwargs):
    if not created:
        return
    notify(
        recipient=instance.submission.student,
        type='assignment_reviewed',
        title='Your submission received a review',
        body=instance.submission.assignment.title,
        link=f'/assignments/{instance.submission.assignment.id}/submissions/{instance.submission.id}',
    )
```

Register signals in each app's `apps.py` `ready()` method.

#### Related Issues
- Blocks: F8

---

## Issue F8: [Frontend] Notification Bell Component

**Labels:** `frontend`, `ui`, `notifications`
**Branch:** `frontend/notifications`
**Assigned to:** Frontend Dev 1 (goes in the Navbar — coordinates with F6)
**Estimated time:** 3 hours

#### Description
Add a notification bell to the Navbar that polls for new notifications
every 30 seconds and shows a dropdown list. Clicking a notification
marks it as read and navigates to its link.

#### Technical Notes

**Polling — no library needed:**
```typescript
// hooks/useNotifications.ts
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { isAuthenticated } = useAuth();

  const fetch = useCallback(async () => {
    if (!isAuthenticated) return;
    const data = await getNotifications();
    setNotifications(data);
  }, [isAuthenticated]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, [fetch]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return { notifications, unreadCount, markAllRead, refresh: fetch };
}
```

**Bell UI — add to Navbar:**
- Bell icon with a red badge showing `unreadCount` (hide badge when 0)
- Click opens a dropdown (absolute positioned, `z-50`)
- Dropdown shows last 10 notifications: icon by type, title, time ago, unread dot
- "Mark all read" button at the top
- Clicking a notification: mark as read → navigate to `notification.link`
- "No notifications yet" empty state

**Services to add in `services/notifications.ts`:**
```typescript
export const getNotifications = () =>
  apiClient.get<Notification[]>('/notifications/').then(r => r.data);

export const markAllNotificationsRead = () =>
  apiClient.patch('/notifications/read/');

export const markNotificationRead = (id: number) =>
  apiClient.patch(`/notifications/${id}/read/`);
```

#### Related Issues
- Depends on: B5, F1, F6 (Navbar lives in F6's scope — coordinate)

---

## Issue B6: [Backend] Public Profile API

**Labels:** `backend`, `api`, `profiles`
**Branch:** `backend/public-profiles`
**Assigned to:** Backend Dev 2
**Estimated time:** 2 hours

#### Description
Expose two new endpoints: one to get any user's public profile by their
`school_id`, and one to search users by name or school ID. The existing
`/auth/me/` endpoint stays unchanged — this is separate read-only data.

#### Technical Notes

**Endpoints:**

`GET /api/profiles/{school_id}/`
Returns public profile data. No authentication required to view.
Response:
```json
{
  "school_id": "23/0145",
  "first_name": "Amine",
  "last_name": "Bensalem",
  "role": "student",
  "bio": "...",
  "avatar": "https://storage.googleapis.com/...",
  "study_year": 2,
  "section": "A",
  "group": 3,
  "joined_at": "2025-09-01T00:00:00Z",
  "stats": {
    "submissions_count": 12,
    "questions_count": 4,
    "answers_count": 17,
    "accepted_answers_count": 3
  },
  "recent_activity": {
    "submissions": [...],   // last 5 public submissions
    "questions": [...],     // last 5 questions
    "answers": [...]        // last 5 answers
  }
}
```
For professors: omit `study_year`, `section`, `group`. The `recent_activity`
block is students only — for professors return an empty object.

`GET /api/profiles/search/?q=amine`
Returns a list of user summaries (school_id, name, role, avatar, study_year).
Searches across `first_name`, `last_name`, and `school_id` fields.
Limit results to 20. Only return `is_verified=True` users.

**Serializer note:**
The `recent_activity.submissions` list should only include
`PersonalSubmission` objects where `visibility='public'`.
Never expose private submissions on a public profile.

#### Related Issues
- Blocks: F9

---

## Issue F9: [Frontend] Public Profile Page + Search

**Labels:** `frontend`, `ui`, `profiles`
**Branch:** `frontend/public-profiles`
**Assigned to:** Frontend Dev 3
**Estimated time:** 4 hours

#### Description
Implement `pages/profile/[school_id].tsx` — a public profile page visible
to all authenticated users. Also add a global user search accessible from
the Navbar. Profile owners see an "Edit profile" button; everyone else sees
a read-only view.

#### Technical Notes

**Profile page layout — top section:**
- Avatar, full name, role badge (Student / Professor), school ID
- Bio text
- Student-only: year, section, group chips
- Stats row: submissions · questions · answers · accepted answers

**Profile page layout — activity tabs (students only):**
Three tabs: Submissions / Questions / Answers
Each tab shows the last 5 items as compact cards linking to the real resource.
For professors: hide the tabs entirely, just show the top section.

**Edit profile button:**
```typescript
const { user } = useAuth();
const isOwner = user?.school_id === router.query.school_id;
// Show edit button only if isOwner
```
The edit button navigates to `/profile/edit` (existing page, no change needed).

**Clickable user icons/names across the platform:**
In `QuestionCard`, `AnswerThread`, `SubmissionCard` — wrap the author name
and avatar in a `<Link href={/profile/${author.school_id}}>` tag.
This is a small change in each component but unifies the pattern everywhere.

**Global user search in Navbar:**
- Small search icon button in the Navbar (not a full search bar — saves space)
- Click opens a modal with a search input
- Debounced input calls `GET /api/profiles/search/?q=...` after 300ms
- Results show avatar, name, role, year — clicking navigates to their profile

#### Related Issues
- Depends on: B6, F1

---

## Issue B7: [Backend] Assignment Edit + PDF Description

**Labels:** `backend`, `api`, `assignments`
**Branch:** `backend/assignment-edit`
**Assigned to:** Backend Dev 1 or 2
**Estimated time:** 2 hours

#### Description
Allow professors to edit their own assignments after creation and
optionally attach a PDF file as the assignment description. The PDF
is stored in GCS and served as a downloadable/viewable URL.

#### Technical Notes

**Model change — add to `Assignment`:**
```python
description_pdf = models.CharField(
    max_length=500, blank=True, null=True
)  # GCS path, same pattern as submission files
```
Run `python manage.py makemigrations assignments`.

**Endpoint — `PATCH /api/assignments/{id}/`**
Already exists as part of CRUD. Verify these fields are writable
in `AssignmentSerializer`:
- `title`
- `description` (text field)
- `description_pdf` (GCS path — handled like submission file uploads)
- `due_date`
- `max_score`

**Do NOT allow editing after the due date has passed.** Add this
validation in the serializer:

```python
def validate(self, data):
    instance = self.instance
    if instance and instance.due_date < timezone.now():
        raise serializers.ValidationError(
            'Cannot edit an assignment after its due date has passed.'
        )
    return data
```

**Do NOT allow changing targeting fields** (`target_year`, `target_sections`,
`target_groups`) after any student has already submitted. Add:
```python
TARGETING_FIELDS = {'target_year', 'target_sections', 'target_groups'}

def validate(self, data):
    instance = self.instance
    if instance:
        changing_targets = TARGETING_FIELDS.intersection(data.keys())
        if changing_targets and instance.submissions.exists():
            raise serializers.ValidationError(
                'Cannot change targeting after students have submitted.'
            )
    return data
```

**PDF upload endpoint — `POST /api/assignments/{id}/upload-description/`**
Same pattern as file uploads in Sprint 2/3. Accept `multipart/form-data`
with a single `file` field. Validate MIME type is `application/pdf` only.
Store at `assignments/{assignment_id}/description.pdf` in GCS.
Return a signed GCS URL valid for 7 days (professor downloads it to view it).

#### Related Issues
- Blocks: F10

---

## Issue F10: [Frontend] Assignment Edit Page + PDF Viewer

**Labels:** `frontend`, `ui`, `assignments`
**Branch:** `frontend/assignment-edit`
**Assigned to:** Frontend Dev 2 or 3
**Estimated time:** 3 hours

#### Description
Implement `pages/assignments/[id]/edit.tsx` — a professor-only form to
edit an existing assignment. Also update the assignment detail page to
show the PDF description if one exists.

#### Technical Notes

**Edit page — prefill form with current assignment data:**
```typescript
// Fetch current assignment on mount, prefill all fields
const { data: assignment } = useSWR(`/assignments/${id}/`, fetchAssignment);
```

**Editable fields:**
- Title (text input)
- Description (textarea)
- Due date (datetime-local input)
- Max score (number input)
- Description PDF (file input — accepts `.pdf` only)

**PDF upload UX:**
- If a PDF already exists: show filename + "Replace PDF" + "Download current PDF" buttons
- If no PDF: show a file drop zone with "Upload PDF description (optional)"
- After selecting a file: show filename + size + "Remove" button
- Upload happens on form submit, not immediately on file select

**On the assignment detail page** (existing page, small addition):
```typescript
{assignment.description_pdf_url && (
  <div>
    <a href={assignment.description_pdf_url} target="_blank" rel="noopener noreferrer">
      📄 View assignment PDF
    </a>
    <a href={assignment.description_pdf_url} download>
      ⬇ Download
    </a>
  </div>
)}
```
The PDF URL is a signed GCS link — it opens in a new tab and browsers
will render it inline for PDF files. No PDF.js needed.

**Access control:**
Show the "Edit assignment" button on the assignment detail page only if
`user.role === 'professor'` and `user.school_id === assignment.professor_school_id`.

#### Related Issues
- Depends on: B7, F1

---
