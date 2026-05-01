# Sprint 4 — Plagiarism Detection & Q&A Forum (Updated)

---

## Architecture Notes (Read Before Starting)

### Plagiarism Detection — MOSS Setup

MOSS works via a **Perl script** that handles the HTTP communication with the Stanford server. You were assigned a unique user ID embedded in that script — you don't register again, your ID is permanent.

**What to do with the Perl script:**
1. Save the script as `moss` in `backend/scripts/moss`
2. Make it executable: `chmod ug+x backend/scripts/moss`
3. Add `backend/scripts/moss` to `.gitignore` — the script contains your personal user ID, never commit it
4. Extract your user ID from line 85 of the script: it looks like `my $userid = 123456789;`
5. Put that number in your `.env` as `MOSS_USER_ID=123456789`
6. The Python `mosspy` library will use this ID directly — you do not need to call the Perl script from Python. The script is just the reference implementation showing how the protocol works.

The `mosspy` Python library replicates what the Perl script does but with a Python API. Keep the script around as documentation but your backend code uses `mosspy` exclusively.

**Multi-language assignments:** Each assignment will have a `languages` field (a JSON list of strings). When running MOSS, files are grouped by language and **one MOSS submission is made per language group**. Files whose extension doesn't match any of the assignment's configured languages are silently skipped and never sent to MOSS.

**Extension → language mapping used for filtering:**
```python
EXTENSION_LANGUAGE_MAP = {
    'py':   'python',
    'c':    'c',
    'h':    'c',
    'cpp':  'cc',
    'cc':   'cc',
    'cxx':  'cc',
    'hpp':  'cc',
    'java': 'java',
    'js':   'javascript',
    'ts':   'javascript',  # MOSS has no TypeScript — use JS
}
```

HTML and CSS are excluded from MOSS because MOSS doesn't have meaningful HTML/CSS support. If an assignment has `languages: ["python", "javascript"]`, only `.py` and `.js`/`.ts` files are sent. `.txt`, `.md`, `.json`, `.css`, `.html` and all other extensions are always skipped.

**Trigger condition:** A professor can only trigger a plagiarism check **after the assignment deadline has passed**. The API enforces this — if `assignment.deadline > timezone.now()`, return 400.

### Q&A Forum — Architecture

The forum is **student-only**. Professors cannot post questions, answers, or votes. They can read but not interact.

**Threaded replies:** Answers are recursive. The `Answer` model has a nullable `parent` ForeignKey pointing to another `Answer`, creating a tree. To keep this manageable, **only one reply per user per parent answer is allowed** (`unique_together = ['parent', 'author']`). This still allows multiple users to reply to the same answer (tree branching), while preventing duplicate replies from the same user on the same parent.

**Tags:** Tags are freeform strings entered by the question author. The platform also has a set of suggested tags (course codes, common languages, help categories) that auto-complete in the UI but don't restrict what the user can type.

**Best answer:** The question author can mark one top-level answer (not a reply) as the best answer. They can only do this after 24 hours from when the question was posted. Once set it cannot be changed.

**Voting:** Both questions and answers (at any nesting level) can be upvoted or downvoted. One vote per user per object — toggle to remove, change to switch. A user cannot vote on their own content.

---

## PLAGIARISM DETECTION MODULE

---

### Issue P1: [Backend] Celery + Redis Setup

**Labels:** `backend`, `devops`, `infrastructure`
**Branch:** `backend/celery-setup`
**Assigned to:** Team Lead (Dhia)

#### Description
Set up Celery with Redis as the message broker. This is required before any async task can run and must be completed and confirmed working on everyone's machine before all other plagiarism backend issues start.

#### Technical Notes

**Add to `requirements/base.txt`:**
```
celery==5.3.6
redis==5.0.1
django-celery-results==2.5.1
```

**Add to `docker-compose.yml`:**
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"

celery:
  build:
    context: ./backend
    dockerfile: Dockerfile
  command: celery -A config worker --loglevel=info --concurrency=2
  volumes:
    - ./backend:/app/backend
    - ./gcs-credentials.json:/app/gcs-credentials.json
  env_file:
    - ./backend/.env
  depends_on:
    - db
    - redis
```

**Add to `config/settings/base.py`:**
```python
CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://redis:6379/0')
CELERY_RESULT_BACKEND = 'django-db'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
INSTALLED_APPS += ['django_celery_results']
```

**Create `config/celery.py`:**
```python
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('esicodehub')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
```

**Update `config/__init__.py`:**
```python
from .celery import app as celery_app
__all__ = ('celery_app',)
```

**Add to `backend/.env` and `backend/.env.example`:**
```
REDIS_URL=redis://redis:6379/0
MOSS_USER_ID=your_moss_user_id_here
```

Run `python manage.py migrate` after adding `django_celery_results`.

**Verify Celery is working** before merging:
```bash
docker-compose exec celery celery -A config inspect ping
```

#### Related Issues
- Blocks: P2, P3

---

### Issue P2: [Backend] Plagiarism Models + Assignment Language Field

**Labels:** `backend`, `models`
**Branch:** `backend/plagiarism-models`

#### Description
Implement all database models for plagiarism detection and add the `languages` field to the existing `Assignment` model.

#### Technical Notes

**Step 1 — Add `languages` to `Assignment` model:**

In `apps/assignment_submissions/models.py`, add to the `Assignment` model:
```python
languages = models.JSONField(
    default=list,
    blank=True,
    help_text='List of programming languages for this assignment. e.g. ["python", "c"]'
)
```

Valid values (enforce in serializer validation):
```python
SUPPORTED_MOSS_LANGUAGES = ['python', 'c', 'c++', 'java', 'javascript']
```

Add to `AssignmentCreateSerializer`:
```python
def validate_languages(self, value):
    valid = {'python', 'c', 'c++', 'java', 'javascript'}
    for lang in value:
        if lang.lower() not in valid:
            raise serializers.ValidationError(
                f"'{lang}' is not a supported language. Choose from: {', '.join(valid)}"
            )
    return [l.lower() for l in value]
```

Run `python manage.py makemigrations assignment_submissions`.

**Step 2 — Create the plagiarism app:**
```bash
docker-compose exec backend python manage.py startapp plagiarism
mv backend/plagiarism backend/apps/plagiarism
```

Add `apps.plagiarism` to `INSTALLED_APPS`.

**`PlagiarismReport` model:**
- `assignment` — OneToOneField → `apps.assignment_submissions.Assignment`, on_delete=CASCADE, `related_name='plagiarism_report'`
- `status` — CharField, choices: `pending`, `running`, `complete`, `failed`, default `pending`
- `triggered_by` — ForeignKey → `settings.AUTH_USER_MODEL`, on_delete=SET_NULL, null=True
- `triggered_at` — DateTimeField, auto_now_add
- `completed_at` — DateTimeField, null=True, blank=True
- `error_message` — TextField, blank=True
- `moss_urls` — JSONField(default=dict, blank=True) — maps language to its MOSS result URL, e.g. `{"python": "https://moss...", "c": "https://moss..."}`
- `db_table = 'plagiarism_reports'`

**`SimilarityMatch` model:**
- `report` — ForeignKey → `PlagiarismReport`, on_delete=CASCADE, `related_name='matches'`
- `submission_a` — ForeignKey → `AssignmentSubmission`, on_delete=CASCADE, `related_name='similarity_matches_as_a'`
- `submission_b` — ForeignKey → `AssignmentSubmission`, on_delete=CASCADE, `related_name='similarity_matches_as_b'`
- `language` — CharField(50) — which language this match came from
- `similarity_a` — IntegerField — % of submission_a matching submission_b
- `similarity_b` — IntegerField — % of submission_b matching submission_a
- `lines_matched` — IntegerField
- `moss_link` — URLField — direct MOSS diff link for this pair
- `db_table = 'similarity_matches'`

```python
@property
def max_similarity(self):
    return max(self.similarity_a, self.similarity_b)
```

Register both models in admin. Run migrations.

#### Related Issues
- Depends on: P1
- Blocks: P3

---

### Issue P3: [Backend] MOSS Integration and Celery Task

**Labels:** `backend`, `celery`, `moss`
**Branch:** `backend/moss-task`

#### Description
Implement the MOSS submission logic and the Celery task that runs plagiarism detection. Files are grouped by language, non-matching files are skipped, and one MOSS submission is made per language group.

#### Technical Notes

**Add to `requirements/base.txt`:**
```
mosspy==1.0.9
beautifulsoup4==4.12.3
lxml==5.1.0
```

**Create `apps/plagiarism/moss.py`:**

```python
import os
import mosspy

MOSS_USER_ID = int(os.getenv('MOSS_USER_ID', '0'))

# Maps file extension → MOSS language identifier
EXTENSION_LANGUAGE_MAP = {
    'py':   'python',
    'c':    'c',
    'h':    'c',
    'cpp':  'cc',
    'cc':   'cc',
    'cxx':  'cc',
    'hpp':  'cc',
    'java': 'java',
    'js':   'javascript',
    'ts':   'javascript',
}

# Maps our language names → MOSS language identifiers
LANGUAGE_MOSS_ID = {
    'python':     'python',
    'c':          'c',
    'c++':        'cc',
    'java':       'java',
    'javascript': 'javascript',
}

def get_file_language(filename: str, assignment_languages: list[str]) -> str | None:
    """
    Returns the language identifier for a file if its extension matches
    one of the assignment's configured languages. Returns None if the file
    should be skipped (wrong extension, or unsupported type like .txt, .md, .css).
    """
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    lang = EXTENSION_LANGUAGE_MAP.get(ext)
    if not lang:
        return None
    # Check if this language is in the assignment's configured languages
    for assigned_lang in assignment_languages:
        if LANGUAGE_MOSS_ID.get(assigned_lang.lower()) == lang:
            return lang
    return None


def run_moss_for_language(
    language: str,
    file_entries: list[tuple[str, int]]  # list of (local_file_path, student_id)
) -> str:
    """
    Submit a group of files for one language to MOSS.
    Files are named {student_id}_{original_filename} so the parser can extract
    the student ID back from MOSS output.
    Returns the MOSS result URL.
    Raises RuntimeError if MOSS returns an empty URL.
    """
    if len(file_entries) < 2:
        raise ValueError(f"Need at least 2 files to run MOSS for {language}.")

    moss_lang = LANGUAGE_MOSS_ID.get(language)
    if not moss_lang:
        raise ValueError(f"Unsupported MOSS language: {language}")

    m = mosspy.Moss(MOSS_USER_ID, moss_lang)
    for local_path, _ in file_entries:
        m.addFile(local_path)

    url = m.send()
    if not url:
        raise RuntimeError(
            f"MOSS returned an empty URL for language '{language}'. "
            "This may indicate a network issue or that MOSS rejected the submission."
        )
    return url
```

**Create `apps/plagiarism/parser.py`:**

```python
import requests
from bs4 import BeautifulSoup


def parse_moss_results(moss_url: str) -> list[dict]:
    """
    Fetch and parse the MOSS HTML report page.
    Returns a list of match dicts. File names in MOSS output are expected to be
    in the format "{student_id}_{original_filename}" as set during submission.

    Returns:
        [
          {
            'student_a_id': int,
            'student_b_id': int,
            'similarity_a': int,
            'similarity_b': int,
            'lines_matched': int,
            'moss_link': str,
          },
          ...
        ]
    """
    response = requests.get(moss_url, timeout=60)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, 'lxml')
    matches = []

    for row in soup.find_all('tr')[1:]:
        cells = row.find_all('td')
        if len(cells) < 3:
            continue

        link_a = cells[0].find('a')
        link_b = cells[1].find('a')
        lines_text = cells[2].get_text(strip=True)

        if not link_a or not link_b:
            continue

        def extract(link):
            # link text is like "23_main.py (72%)"
            text = link.get_text()
            try:
                pct = int(text.split('(')[1].rstrip('%)'))
                filename = text.split('(')[0].strip()
                student_id = int(filename.split('_')[0])
                return student_id, pct
            except (IndexError, ValueError):
                return None, None

        sid_a, pct_a = extract(link_a)
        sid_b, pct_b = extract(link_b)

        if None in (sid_a, pct_a, sid_b, pct_b):
            continue

        try:
            lines = int(lines_text)
        except ValueError:
            lines = 0

        matches.append({
            'student_a_id': sid_a,
            'student_b_id': sid_b,
            'similarity_a': pct_a,
            'similarity_b': pct_b,
            'lines_matched': lines,
            'moss_link': link_a['href'],
        })

    return matches
```

**Create `apps/plagiarism/tasks.py`:**

```python
import os
import tempfile
from celery import shared_task
from django.utils import timezone

from apps.assignment_submissions.models import AssignmentSubmission
from apps.personal_submissions.gcs import get_file_content
from .models import PlagiarismReport, SimilarityMatch
from .moss import get_file_language, run_moss_for_language
from .parser import parse_moss_results


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def run_plagiarism_check(self, report_id: int):
    report = PlagiarismReport.objects.select_related('assignment').get(id=report_id)
    report.status = 'running'
    report.save(update_fields=['status'])

    try:
        assignment = report.assignment
        assignment_languages = [l.lower() for l in (assignment.languages or [])]

        if not assignment_languages:
            report.status = 'failed'
            report.error_message = 'Assignment has no languages configured.'
            report.completed_at = timezone.now()
            report.save(update_fields=['status', 'error_message', 'completed_at'])
            return

        submissions = list(
            AssignmentSubmission.objects.filter(assignment=assignment)
            .prefetch_related('files')
            .select_related('student')
        )

        if len(submissions) < 2:
            report.status = 'complete'
            report.error_message = 'Not enough submissions to compare (minimum 2 required).'
            report.completed_at = timezone.now()
            report.save(update_fields=['status', 'error_message', 'completed_at'])
            return

        # Build a map: student_id → AssignmentSubmission
        submission_map = {sub.student_id: sub for sub in submissions}

        with tempfile.TemporaryDirectory() as tmpdir:
            # Group files by language, skip files that don't match assignment languages
            language_groups: dict[str, list[tuple[str, int]]] = {
                lang: [] for lang in assignment_languages
            }

            for sub in submissions:
                student_id = sub.student_id
                for f in sub.files.all():
                    lang = get_file_language(f.file_name, assignment_languages)
                    if lang is None:
                        continue  # skip .txt, .md, .css, etc.

                    # Name: {student_id}_{file_name} — parser uses this to extract student_id
                    local_name = f"{student_id}_{f.file_name}"
                    local_path = os.path.join(tmpdir, local_name)

                    content = get_file_content(f.gcs_path)
                    with open(local_path, 'w', encoding='utf-8') as fp:
                        fp.write(content)

                    language_groups[lang].append((local_path, student_id))

            moss_urls = {}
            all_matches = []

            for lang, file_entries in language_groups.items():
                if len(file_entries) < 2:
                    continue  # not enough files in this language to compare

                url = run_moss_for_language(lang, file_entries)
                moss_urls[lang] = url

                matches = parse_moss_results(url)
                for m in matches:
                    m['language'] = lang
                all_matches.extend(matches)

            report.moss_urls = moss_urls
            report.save(update_fields=['moss_urls'])

            # Save SimilarityMatch records
            SimilarityMatch.objects.filter(report=report).delete()
            for match in all_matches:
                sub_a = submission_map.get(match['student_a_id'])
                sub_b = submission_map.get(match['student_b_id'])
                if not sub_a or not sub_b:
                    continue
                SimilarityMatch.objects.create(
                    report=report,
                    submission_a=sub_a,
                    submission_b=sub_b,
                    language=match['language'],
                    similarity_a=match['similarity_a'],
                    similarity_b=match['similarity_b'],
                    lines_matched=match['lines_matched'],
                    moss_link=match['moss_link'],
                )

        report.status = 'complete'
        report.completed_at = timezone.now()
        report.save(update_fields=['status', 'completed_at'])

    except Exception as exc:
        report.status = 'failed'
        report.error_message = str(exc)
        report.completed_at = timezone.now()
        report.save(update_fields=['status', 'error_message', 'completed_at'])
        raise self.retry(exc=exc)
```

  **Optimization:** If a language group contains only AI reference files (no student
  submissions), the task skips the MOSS submission for that language.

#### Related Issues
- Depends on: P1, P2
- Blocks: P4

---

### Issue P4: [Backend] Plagiarism API Endpoints

**Labels:** `backend`, `api`
**Branch:** `backend/plagiarism-api`

#### Description
Implement REST endpoints that trigger plagiarism detection and expose results. Professor-only. Trigger is blocked until the assignment deadline has passed.

#### Technical Notes

**`POST /api/assignments/<id>/plagiarism-report/run/`**
- Professor only (return 403 if `request.user.role != 'professor'`)
- Check `assignment.deadline > timezone.now()` → return 400 `{ "detail": "Plagiarism check can only be run after the assignment deadline has passed." }`
- Check `assignment.languages` is not empty → return 400 `{ "detail": "This assignment has no languages configured. Add at least one language before running a check." }`
- If report exists and status is `pending` or `running` → return 400 `{ "detail": "A check is already in progress." }`
- If report exists and status is `complete` or `failed` → delete existing `SimilarityMatch` records, reset report to `pending`
- Otherwise create new `PlagiarismReport`
- Set `triggered_by = request.user`
- Queue: `run_plagiarism_check.delay(report.id)`
- Return 202 `{ "report_id": report.id, "status": "pending" }`

**`GET /api/assignments/<id>/plagiarism-report/`**
- Professor only
- Returns 404 if no report exists yet
- Response shape:
```json
{
  "id": 1,
  "status": "complete",
  "triggered_by": "prof@esi.dz",
  "triggered_at": "...",
  "completed_at": "...",
  "moss_urls": { "python": "https://...", "c": "https://..." },
  "error_message": "",
  "match_count": 12,
  "matches": [
    {
      "id": 1,
      "language": "python",
      "student_a_name": "...",
      "student_a_email": "...",
      "student_b_name": "...",
      "student_b_email": "...",
      "similarity_a": 87,
      "similarity_b": 74,
      "max_similarity": 87,
      "lines_matched": 143,
      "moss_link": "https://moss.stanford.edu/..."
    }
  ]
}
```

Wire up in `apps/plagiarism/urls.py` and include in `config/urls.py` under `api/assignments/`.

#### Related Issues
- Depends on: P3
- Blocks: P5

---

### Issue P5: [Frontend] Plagiarism Service Layer

**Labels:** `frontend`, `api`
**Branch:** `frontend/plagiarism-api-service`

#### Description
Create the TypeScript service layer for plagiarism detection.

#### Technical Notes

Structure:
```
services/plagiarism/
  index.ts
  plagiarism.types.ts
  plagiarism.api.ts
```

**`plagiarism.types.ts`:**
```typescript
export type PlagiarismStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface SimilarityMatch {
  id: number;
  language: string;
  student_a_name: string;
  student_a_email: string;
  student_b_name: string;
  student_b_email: string;
  similarity_a: number;
  similarity_b: number;
  max_similarity: number;
  lines_matched: number;
  moss_link: string;
}

export interface PlagiarismReport {
  id: number;
  status: PlagiarismStatus;
  triggered_by: string;
  triggered_at: string;
  completed_at: string | null;
  moss_urls: Record<string, string>;
  error_message: string;
  match_count: number;
  matches: SimilarityMatch[];
}
```

**`plagiarism.api.ts`:**
```typescript
import apiClient from '@/lib/axios';
import type { PlagiarismReport } from './plagiarism.types';

export const triggerPlagiarismCheck = async (
  assignmentId: number
): Promise<{ report_id: number; status: string }> => {
  const res = await apiClient.post(
    `/assignments/${assignmentId}/plagiarism-report/run/`
  );
  return res.data;
};

export const getPlagiarismReport = async (
  assignmentId: number
): Promise<PlagiarismReport> => {
  const res = await apiClient.get<PlagiarismReport>(
    `/assignments/${assignmentId}/plagiarism-report/`
  );
  return res.data;
};
```

#### Related Issues
- Depends on: P4
- Blocks: P6

---

### Issue P6: [Frontend] Plagiarism Report Page

**Labels:** `frontend`, `ui`
**Branch:** `frontend/plagiarism-report-page`

#### Description
Implement the plagiarism report page at `pages/assignments/[id]/plagiarism.tsx`. Professor-only.

#### Technical Notes

**States to handle:**

**No report yet:** Empty state with an info note — "Plagiarism check can only be run after the deadline has passed." If the deadline has passed: show "Run Plagiarism Check" button. If still open: show button as disabled with tooltip.

**`pending` / `running`:** Animated spinner. "Analysing submissions… This may take a few minutes." Poll `getPlagiarismReport()` every 5 seconds. Do not poll if status is `complete` or `failed`.

**`failed`:** Red error banner showing `error_message`. Retry button.

**`complete`:** Results table (see below).

**Results table:**
- Summary line: "X pairs flagged across Y language groups" — where flagged means `max_similarity >= 70`
- Language tabs if multiple languages were checked (one tab per language in `moss_urls`) — each tab shows only matches for that language
- Table columns: Student A (name + email), Student B (name + email), Language badge, A's match %, B's match %, Lines matched, "View diff →" (external link to `moss_link`)
- Row color: green if `max_similarity < 50`, orange if 50–70, red if ≥ 70
- Sortable by max similarity descending by default
- A note below the table: "These results indicate code similarity, not confirmed plagiarism. Manual review is required before any academic action."

**Access control:**
- Wrap with `ProtectedRoute allowedRole="professor"`
- `next/router`, `<Link>` from `next/link`
- No `"use client"`, no `next/navigation`

**Design freedom:** Visual details are open. Make the severity color coding clear, the empty/loading/error states polished, and the table scannable at a glance.

#### Related Issues
- Depends on: P5

---

---

## Q&A FORUM MODULE

---

### Issue Q1: [Backend] Forum Models

**Labels:** `backend`, `models`
**Branch:** `backend/forum-models`

#### Description
Implement all database models for the Reddit-style Q&A forum. Student-only. Answers are threaded (recursive). One vote per user per content item. One reply per user per answer.

#### Technical Notes

**Create the app:**
```bash
docker-compose exec backend python manage.py startapp forum
mv backend/forum backend/apps/forum
```

Add `apps.forum` and `'django.contrib.contenttypes'` to `INSTALLED_APPS` (if not already present).

**`Question` model:**
- `author` — ForeignKey → `settings.AUTH_USER_MODEL`, on_delete=CASCADE, `related_name='questions'`
- `title` — CharField(300)
- `body` — TextField
- `code_snippet` — TextField, blank=True — optional code attached to the question
- `code_language` — CharField(50), blank=True
- `tags` — JSONField(default=list, blank=True) — list of strings e.g. `["ASD", "python", "help"]`
- `is_closed` — BooleanField, default=False
- `accepted_answer` — ForeignKey → `'Answer'`, on_delete=SET_NULL, null=True, blank=True, `related_name='+'`
  — Note: use a string reference `'Answer'` since Answer is defined after Question
- `view_count` — PositiveIntegerField, default=0
- `created_at` — DateTimeField, auto_now_add
- `updated_at` — DateTimeField, auto_now
- `db_table = 'forum_questions'`
- `ordering = ['-created_at']`

Add a property:
```python
@property
def can_accept_answer(self):
    from django.utils import timezone
    from datetime import timedelta
    return timezone.now() >= self.created_at + timedelta(hours=24)
```

**`Answer` model:**
- `question` — ForeignKey → `Question`, on_delete=CASCADE, `related_name='answers'`
- `parent` — ForeignKey → `'self'`, on_delete=CASCADE, null=True, blank=True, `related_name='replies'`
  — null means this is a top-level answer. Non-null means it is a reply to another answer.
- `author` — ForeignKey → `settings.AUTH_USER_MODEL`, on_delete=CASCADE, `related_name='forum_answers'`
- `body` — TextField
- `code_snippet` — TextField, blank=True
- `code_language` — CharField(50), blank=True
- `is_accepted` — BooleanField, default=False — denormalized from Question.accepted_answer for query performance
- `created_at` — DateTimeField, auto_now_add
- `updated_at` — DateTimeField, auto_now
- `db_table = 'forum_answers'`
- `ordering = ['-created_at']`
- `unique_together = [['parent', 'author']]`
  — This enforces the Reddit rule: one reply per user per answer. For top-level answers (`parent=null`), this constraint does not apply (multiple top-level answers per user are fine — there's no unique_together on null values in most databases).

**`Vote` model:**
- `user` — ForeignKey → `settings.AUTH_USER_MODEL`, on_delete=CASCADE
- `content_type` — ForeignKey → `ContentType`, on_delete=CASCADE
- `object_id` — PositiveIntegerField
- `content_object` — GenericForeignKey('content_type', 'object_id')
- `value` — SmallIntegerField, choices: `((1, 'Upvote'), (-1, 'Downvote'))`
- `created_at` — DateTimeField, auto_now_add
- `unique_together = [['user', 'content_type', 'object_id']]`
- `db_table = 'forum_votes'`

Register all models in admin. Run migrations.

#### Related Issues
- Blocks: Q2, Q3

---

### Issue Q2: [Backend] Forum Serializers

**Labels:** `backend`, `serializers`
**Branch:** `backend/forum-serializers`

#### Description
Implement DRF serializers for all forum models.

#### Technical Notes

**Helper — `get_vote_score(obj)`:**
A reusable method to annotate vote scores. Use `Coalesce(Sum('votes__value'), 0)` via `annotate()` in querysets, or compute in a `SerializerMethodField`.

**`AnswerSerializer`** (recursive — used for both answers and replies):
```python
class AnswerSerializer(serializers.ModelSerializer):
    author_name    = serializers.SerializerMethodField()
    author_email   = serializers.SerializerMethodField()
    vote_score     = serializers.SerializerMethodField()
    user_vote      = serializers.SerializerMethodField()
    reply_count    = serializers.SerializerMethodField()
    replies        = serializers.SerializerMethodField()

    def get_replies(self, obj):
      # Recursive serialization: returns nested replies for the full thread.
        replies = obj.replies.all().order_by('created_at')
        return AnswerSerializer(replies, many=True, context=self.context).data
```

Fields: `id`, `question`, `parent` (id only), `author_name`, `author_email`, `body`, `code_snippet`, `code_language`, `is_accepted`, `vote_score`, `user_vote`, `reply_count`, `replies`, `created_at`, `updated_at`

**`QuestionListSerializer`:**
Fields: `id`, `title`, `tags`, `author_name`, `answer_count` (computed), `vote_score` (computed), `has_accepted_answer` (bool), `view_count`, `created_at`
- Does NOT include `body`, `code_snippet`, or answers

**`QuestionDetailSerializer`:**
All list fields plus: `body`, `code_snippet`, `code_language`, `is_closed`, `author_email`, `can_accept_answer`
- Includes `answers`: only top-level answers (`parent=None`), each with their nested `replies`

**`QuestionCreateSerializer`:**
Fields: `title`, `body`, `code_snippet`, `code_language`, `tags`
Validate:
- `title` not blank
- `body` not blank
- `tags` is a list of strings, max 5 tags, each max 50 characters

**`AnswerCreateSerializer`:**
Fields: `body`, `code_snippet`, `code_language`
Validate: `body` not blank

#### Related Issues
- Depends on: Q1
- Blocks: Q3

---

### Issue Q3: [Backend] Forum API Endpoints

**Labels:** `backend`, `api`
**Branch:** `backend/forum-api`

#### Description
Implement all REST endpoints for the Q&A forum. Student-only — professors can read but not post, vote, or accept answers. All write operations check `request.user.role == 'student'` and return 403 otherwise.

#### Technical Notes

**Question endpoints:**

`GET /api/forum/questions/`
- Auth required
- Query params:
  - `?tag=<str>` — filter by single tag (case-insensitive contains match on `tags` JSONField)
  - `?search=<str>` — search title only (case-insensitive)
  - `?author=<email>` — filter by author email
  - `?ordering=newest|top|unanswered` — default `newest`
    - `newest`: `-created_at`
    - `top`: annotate with `Sum('votes__value')`, order descending. Use `?ordering=top` — backend handles it.
    - `unanswered`: `answer_count=0`, `-created_at`
  - `?page=<int>` — paginated 20 per page
- Returns `QuestionListSerializer`

`POST /api/forum/questions/`
- Student only
- Returns `QuestionDetailSerializer` with 201

`GET /api/forum/questions/<id>/`
- Auth required
- Increment `view_count` using `F('view_count') + 1` to avoid race conditions:
  ```python
  Question.objects.filter(pk=pk).update(view_count=F('view_count') + 1)
  ```
- Returns `QuestionDetailSerializer`

`PATCH /api/forum/questions/<id>/`
- Author only (student)
- Allowed fields: `title`, `body`, `code_snippet`, `code_language`, `tags`, `is_closed`
- Cannot edit if question has an accepted answer

`DELETE /api/forum/questions/<id>/`
- Author only (student)
- Cannot delete if question has an accepted answer

**Answer endpoints:**

`POST /api/forum/questions/<id>/answers/`
- Student only
- Body: `{ "body": "...", "code_snippet": "...", "code_language": "...", "parent_id": null }`
- `parent_id` is null for top-level answers, or an Answer ID for replies
- Validate: if `parent_id` is provided, the parent answer must belong to the same question
- Validate: if `parent_id` is provided, enforce `unique_together` — return 400 if this user already replied to that answer
- Cannot post if `question.is_closed`
- Returns `AnswerSerializer` with 201

`PATCH /api/forum/questions/<qid>/answers/<aid>/`
- Answer author only (student)
- Allowed fields: `body`, `code_snippet`, `code_language`

`DELETE /api/forum/questions/<qid>/answers/<aid>/`
- Answer author only (student)
- Cannot delete the accepted answer

`POST /api/forum/questions/<qid>/answers/<aid>/accept/`
- Question author only (student)
- Check `question.can_accept_answer` (24h rule) → return 400 if too early: `{ "detail": "You can only accept an answer 24 hours after posting the question." }`
- Check question does not already have an accepted answer → return 400 if it does
- Only top-level answers can be accepted (`parent=null`) → return 400 if trying to accept a reply
- Set `question.accepted_answer = answer`
- Set `answer.is_accepted = True`
- Save both in `transaction.atomic()`
- Returns updated `AnswerSerializer`

**Vote endpoints:**

`POST /api/forum/questions/<id>/vote/`
- Student only
- Body: `{ "value": 1 }` or `{ "value": -1 }`
- Cannot vote on own content → return 403
- If same vote exists: delete it (toggle off)
- If opposite vote exists: update it
- If no vote exists: create it
- Returns `{ "vote_score": <new_total> }`

`POST /api/forum/questions/<qid>/answers/<aid>/vote/`
- Same logic as question vote

Wire up in `apps/forum/urls.py`, include in `config/urls.py` under `api/forum/`.

#### Related Issues
- Depends on: Q1, Q2
- Blocks: Q4, Q5

---

### Issue Q4: [Frontend] Forum Service Layer

**Labels:** `frontend`, `api`
**Branch:** `frontend/forum-api-service`

#### Description
Create the TypeScript service layer for the Q&A forum. Import `PaginatedResponse` from `services/submissions/submissions.types` — do not redefine it.

#### Technical Notes

Structure:
```
services/forum/
  index.ts
  forum.types.ts
  forum.api.ts
```

**`forum.types.ts`:**
```typescript
export type ForumOrdering = 'newest' | 'top' | 'unanswered';

export interface Answer {
  id: number;
  question: number;
  parent: number | null;
  author_name: string;
  author_email: string;
  body: string;
  code_snippet: string;
  code_language: string;
  is_accepted: boolean;
  vote_score: number;
  user_vote: 1 | -1 | null;
  reply_count: number;
  replies: Answer[];  // recursive
  created_at: string;
  updated_at: string;
}

export interface QuestionListItem {
  id: number;
  title: string;
  tags: string[];
  author_name: string;
  answer_count: number;
  vote_score: number;
  has_accepted_answer: boolean;
  view_count: number;
  created_at: string;
}

export interface QuestionDetail extends QuestionListItem {
  body: string;
  code_snippet: string;
  code_language: string;
  is_closed: boolean;
  author_email: string;
  can_accept_answer: boolean;
  answers: Answer[];
}

export interface QuestionCreatePayload {
  title: string;
  body: string;
  code_snippet?: string;
  code_language?: string;
  tags?: string[];
}

export interface AnswerCreatePayload {
  body: string;
  code_snippet?: string;
  code_language?: string;
  parent_id?: number | null;
}

export interface ForumListParams {
  tag?: string;
  search?: string;
  author?: string;
  ordering?: ForumOrdering;
  page?: number;
}
```

**`forum.api.ts`** — all functions use `apiClient` and return `res.data`:

Functions:
- `listQuestions(params?: ForumListParams)`
- `getQuestion(id: number)`
- `createQuestion(data: QuestionCreatePayload)`
- `updateQuestion(id: number, data: Partial<QuestionCreatePayload>)`
- `deleteQuestion(id: number)`
- `createAnswer(questionId: number, data: AnswerCreatePayload)`
- `updateAnswer(questionId: number, answerId: number, data: Partial<AnswerCreatePayload>)`
- `deleteAnswer(questionId: number, answerId: number)`
- `acceptAnswer(questionId: number, answerId: number)`
- `voteQuestion(questionId: number, value: 1 | -1)`
- `voteAnswer(questionId: number, answerId: number, value: 1 | -1)`

#### Related Issues
- Depends on: Q3
- Blocks: Q5, Q6

---

### Issue Q5: [Frontend] Forum List Page

**Labels:** `frontend`, `ui`
**Branch:** `frontend/forum-list-page`

#### Description
Implement the forum list page at `pages/forum/index.tsx`. Reddit-style question feed with filtering by tag, author, and sort order.

#### Technical Notes

**Page layout — Reddit-inspired:**

**Left sidebar (desktop only):**
- "Ask a Question" button → `/forum/new`
- Filter by tag: a list of clickable tag chips. Clicking a tag sets `?tag=` filter.
- Popular tags section: show the most common tags across all questions. Derive this client-side from the loaded questions' tags array — no separate API call needed.

**Main feed:**
- Sorting tabs at the top: "Newest" | "Top Voted" | "Unanswered" — maps to `ordering` param
- Search bar — debounced 300ms, maps to `search` param
- Author filter — a text input for filtering by author email, maps to `author` param
- Question cards (see below)
- "Load more" button — appends next page

**Question card:**
- Vote score on the left (large number, up/down arrows) — students can vote directly from the list. Call `voteQuestion()`, update score optimistically.
- Right side: title, tags (colored chips), author name + time ago, answer count badge (green if has accepted answer), view count
- Clicking the card navigates to `/forum/<id>`
- "Accepted answer" indicator — a small green checkmark if `has_accepted_answer`

**Random shuffle on each visit:**
The backend `?ordering=newest` always returns the same order. To give the feel of different content on each visit, when `ordering === 'newest'` shuffle the first page of results client-side using a random seed derived from `Date.now()`. This is simple, requires no backend changes, and gives the appearance of variety. Do not shuffle when `ordering` is `top` or `unanswered` — those have meaningful order.

**Empty states:**
- No results for current filters: "No questions match your filters."
- No questions at all: "No questions yet. Be the first to ask the community!"

**Access control:**
- Wrap with `ProtectedRoute`
- No `"use client"`, no `next/navigation`

**Design freedom:** The page should feel like Reddit's `/r/` page. Vote buttons on the left, post content on the right, tag chips, and a clean feed layout. The color palette should stay consistent with the rest of the app (dark navy / blue / white) but adapted to a feed layout.

#### Related Issues
- Depends on: Q4

---

### Issue Q6: [Frontend] Ask a Question Page + Question Detail Page

**Labels:** `frontend`, `ui`
**Branch:** `frontend/forum-question-pages`

#### Description
Implement two pages: the question creation form at `pages/forum/new.tsx` and the full question + answer thread at `pages/forum/[id].tsx`.

#### Technical Notes

**Ask a Question (`pages/forum/new.tsx`):**

Fields:
- Title — required, max 300 characters with counter
- Body — required textarea
- Code snippet — optional, Monaco Editor in edit mode (not read-only), language selector next to it
- Tags — tag input, max 5 tags, max 50 chars each. Show suggested tags as autocomplete below the input (derive suggestions from a hardcoded list of subject codes + common programming terms)

Client-side validation: title and body required.
On submit: call `createQuestion()`, redirect to `/forum/<id>` on success.
Wrap with `ProtectedRoute`.

**Question Detail (`pages/forum/[id].tsx`):**

**Top section — Question:**
- Title, tags, view count, time ago
- Body
- If `code_snippet`: Monaco Editor, read-only, dark theme, `{ ssr: false }` dynamic import
- Vote buttons (up/down) with current score — `voteQuestion()`, optimistic update
- Author name
- If author is current user: Edit / Delete / Close buttons
- "Question is closed" banner if `is_closed`

**Answer thread (recursive rendering):**

Each answer renders:
- Vote buttons + score (left column)
- Author name, time ago
- Body
- If `code_snippet`: Monaco Editor, read-only
- If `is_accepted`: green "✓ Best Answer" badge — pin accepted answer to the top of the list
- "Accept" button — shown only to question author, only if `can_accept_answer === true` and no accepted answer yet, only on top-level answers
- "Reply" button — shown to all students, expands an inline reply form below the answer
- If author is current user: Edit / Delete buttons

Replies render the same component recursively, indented by 16px per depth level. There is no depth limit in the UI — the backend constrains it via `unique_together`.

**Reply form (inline, expands on "Reply" click):**
- Textarea for body
- Optional code snippet + language
- "Post Reply" button — calls `createAnswer()` with `parent_id` set
- "Cancel" button — collapses the form

**Post an Answer (bottom of page):**
- Textarea for body
- Optional Monaco Editor for code snippet
- "Post Answer" button — calls `createAnswer()` with `parent_id: null`
- If `question.is_closed`: replace with "This question is closed and no longer accepting answers."
- After posting: append the new answer to the list without a full page reload

**Access control:**
- Wrap with `ProtectedRoute`
- No `"use client"`, no `next/navigation`
- `<Link>` from `next/link` for all internal navigation

**Design freedom:** The thread layout should feel like Reddit's comment tree. Indented replies, collapsible threads (optional — collapse deep threads with a "show more replies" link), and the accepted answer visually pinned and highlighted are the core requirements. Monaco Editor for code snippets should match the dark theme used in the submission detail page.

#### Related Issues
- Depends on: Q4, Q5

---

## Implementation Order

**Plagiarism:** P1 → P2 → P3 → P4 → P5 → P6 (strictly sequential, each blocks the next)

**Q&A Forum:** Q1 → Q2 → Q3 (backend, sequential) then Q4 → Q5 → Q6 (frontend, sequential). Backend and frontend tracks can run in parallel once Q3 is done.

**Both modules are independent of each other** — assign one team to Plagiarism and one to Q&A Forum simultaneously.

**P1 is the highest priority** — Celery setup affects the whole backend environment. Assign to the team lead and complete it in the first two days of the sprint before any other plagiarism work starts.
