import os
import tempfile
import logging
from celery import shared_task
from django.utils import timezone

from apps.assignment_submissions.models import AssignmentSubmission
from apps.personal_submissions.gcs import get_file_content
from .models import PlagiarismReport, SimilarityMatch
from .moss import get_file_language, run_moss_for_language, LANGUAGE_MOSS_ID
from .parser import parse_moss_results

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def run_plagiarism_check(self, report_id: int):
    report = PlagiarismReport.objects.select_related('assignment').get(id=report_id)
    report.status = 'running'
    report.save(update_fields=['status'])

    try:
        assignment = report.assignment
        assignment_languages = [lang.lower() for lang in (assignment.languages or [])]

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
            language_groups: dict[str, list[tuple[str, int]]] = {}
            for lang in assignment_languages:
                moss_id = LANGUAGE_MOSS_ID.get(lang.lower())
                if moss_id and moss_id not in language_groups:
                    language_groups[moss_id] = []

            # Load AI reference files into each language group
            # References are named "ai_ref_{style}" so the parser knows they are
            # not students
            from .ai_generator import STYLES
            from .models import AIReferenceSubmission

            ai_references = AIReferenceSubmission.objects.filter(assignment=assignment)
            ai_ref_student_ids = set()

            for ref in ai_references:
                lang = LANGUAGE_MOSS_ID.get(ref.language)
                if not lang or lang not in language_groups:
                    continue

                # Use a sentinel student ID that cannot clash with real IDs
                # Convention: AI references use negative IDs starting from -1
                sentinel_id = -(list(STYLES.keys()).index(ref.style) + 1)
                ai_ref_student_ids.add(sentinel_id)

                local_name = f"{sentinel_id}_{ref.file_name}"
                local_path = os.path.join(tmpdir, local_name)

                content = get_file_content(ref.gcs_path)
                with open(local_path, 'w', encoding='utf-8') as fp:
                    fp.write(content)

                language_groups[lang].append((local_path, sentinel_id))

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
                is_ai_a = match['student_a_id'] in ai_ref_student_ids
                is_ai_b = match['student_b_id'] in ai_ref_student_ids

                # Skip if both sides are AI references (they matched each other)
                if is_ai_a and is_ai_b:
                    continue

                # Skip if neither side is identifiable
                if sub_a is None and not is_ai_a:
                    continue
                if sub_b is None and not is_ai_b:
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
                    ai_moss_flag=is_ai_a or is_ai_b,
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


@shared_task(bind=True, max_retries=1, default_retry_delay=30)
def generate_ai_references(self, assignment_id: int):
    """
    Generate AI reference submissions for all configured languages of an
    assignment and upload them to GCS.
    Called when a professor clicks 'Generate AI References' or when a
    plagiarism check is triggered and no references exist yet.
    """
    from apps.assignment_submissions.models import Assignment
    from apps.personal_submissions.gcs import upload_file_content
    from .models import AIReferenceSubmission
    from .ai_generator import generate_reference_solution, EXTENSION_MAP, STYLES

    assignment = Assignment.objects.get(id=assignment_id)
    languages = [lang.lower() for lang in (assignment.languages or [])]

    if not languages:
        # Nothing to generate , assignment has no languages configured
        return

    # Delete stale references before regenerating
    AIReferenceSubmission.objects.filter(assignment=assignment).delete()

    for language in languages:
        ext = EXTENSION_MAP.get(language, 'txt')

        for style in STYLES.keys():
            try:
                code = generate_reference_solution(
                    language=language,
                    style=style,
                    assignment_title=assignment.title,
                    assignment_description=assignment.description or '',
                )

                gcs_path = AIReferenceSubmission.build_gcs_path(
                    assignment.id,
                    language,
                    style,
                    ext,
                )

                # Upload generated code as plain text to GCS
                upload_file_content(gcs_path, code)

                AIReferenceSubmission.objects.create(
                    assignment=assignment,
                    language=language,
                    style=style,
                    gcs_path=gcs_path,
                    file_name=f"{language}_{style}.{ext}",
                )

            except Exception as exc:
                # Log and continue , one failed style doesn't abort the whole task
                logger.warning(
                    f"AI reference generation failed: assignment={assignment_id} "
                    f"language={language} style={style} error={exc}"
                )
                continue
