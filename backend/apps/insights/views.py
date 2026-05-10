from django.db.models import Avg, Count
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assignment_submissions.models import Assignment, AssignmentSubmission
from apps.forum.models import Answer, Question
from apps.forum.utils import get_forum_leaderboard
from apps.personal_submissions.models import PersonalSubmission
from apps.plagiarism.models import PlagiarismReport, SimilarityMatch


def _get_esi_record(user):
    from apps.esi_db.models import EsiStudent
    try:
        return EsiStudent.objects.get(school_id=user.school_id)
    except EsiStudent.DoesNotExist:
        return None


def _filter_targeted(assignments, esi):
    result = []
    for assignment in assignments:
        if assignment.target_sections and esi.section not in assignment.target_sections:
            continue
        if assignment.target_groups and esi.group not in assignment.target_groups:
            continue
        result.append(assignment)
    return result


# -----------------------------------------------------------------------
# Student endpoint
# -----------------------------------------------------------------------

class StudentInsightsView(APIView):
    """GET /api/insights/student/"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'leaderboard':        get_forum_leaderboard(),
            'recent_assignments': self._recent_assignments(user),
            'recent_submissions': self._recent_submissions(user),
            'personal_stats':     self._personal_stats(user),
        })

    def _recent_assignments(self, user):
        esi = _get_esi_record(user)
        if esi is None:
            return []

        assignments = list(
            Assignment.objects
            .filter(target_year=esi.study_year)
            .select_related('subject')
            .order_by('deadline')
        )
        targeted = _filter_targeted(assignments, esi)

        submitted_ids = set(
            AssignmentSubmission.objects
            .filter(student=user)
            .values_list('assignment_id', flat=True)
        )

        return [
            {
                'id':            a.id,
                'title':         a.title,
                'subject':       a.subject.code,
                'due_date':      a.deadline,
                'has_submitted': a.id in submitted_ids,
                'is_open':       a.is_open_for_submission(),
            }
            for a in targeted[:5]
        ]

    def _recent_submissions(self, user):
        submissions = (
            PersonalSubmission.objects
            .filter(owner=user)
            .order_by('-created_at')[:5]
        )
        return [
            {
                'id':         s.id,
                'title':      s.title,
                'language':   s.language,
                'visibility': s.visibility,
                'created_at': s.created_at,
            }
            for s in submissions
        ]

    def _personal_stats(self, user):
        esi = _get_esi_record(user)

        submitted_ids = set(
            AssignmentSubmission.objects
            .filter(student=user)
            .values_list('assignment_id', flat=True)
        )

        if esi is not None:
            all_targeted = list(
                Assignment.objects.filter(target_year=esi.study_year)
            )
            targeted = _filter_targeted(all_targeted, esi)
            assignments_pending = sum(
                1 for a in targeted
                if a.is_open_for_submission() and a.id not in submitted_ids
            )
        else:
            assignments_pending = 0

        return {
            'total_submissions':     PersonalSubmission.objects.filter(owner=user).count(),
            'assignments_completed': len(submitted_ids),
            'assignments_pending':   assignments_pending,
            'forum_questions':       Question.objects.filter(author=user).count(),
            'forum_answers':         Answer.objects.filter(author=user).count(),
        }


# -----------------------------------------------------------------------
# Professor endpoint
# -----------------------------------------------------------------------

class ProfessorInsightsView(APIView):
    """GET /api/insights/professor/"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'platform_ai_stats':  self._platform_ai_stats(),
            'professor_ai_stats': self._professor_ai_stats(user),
            'assignment_summary': self._assignment_summary(user),
        })

    def _platform_ai_stats(self):
        checked = PlagiarismReport.objects.filter(
            status=PlagiarismReport.Status.COMPLETE,
        ).count()
        flagged = SimilarityMatch.objects.filter(ai_moss_flag=True).count()
        percentage = round(flagged / checked * 100, 1) if checked else 0.0

        return {
            'total_submissions_checked': checked,
            'ai_flagged_count':          flagged,
            'ai_flagged_percentage':     percentage,
        }

    def _professor_ai_stats(self, user):
        prof_assignments = Assignment.objects.filter(professor=user)

        checked = PlagiarismReport.objects.filter(
            assignment__in=prof_assignments,
            status=PlagiarismReport.Status.COMPLETE,
        ).count()
        flagged = SimilarityMatch.objects.filter(
            report__assignment__in=prof_assignments,
            ai_moss_flag=True,
        ).count()
        percentage = round(flagged / checked * 100, 1) if checked else 0.0

        return {
            'total_submissions_checked': checked,
            'ai_flagged_count':          flagged,
            'ai_flagged_percentage':     percentage,
        }

    def _assignment_summary(self, user):
        assignments = (
            Assignment.objects
            .filter(professor=user)
            .select_related('subject')
            .annotate(
                submission_count=Count('submissions', distinct=True),
                avg_score=Avg('submissions__reviews__grade'),
            )
            .order_by('-created_at')
        )

        # Fetch flagged counts per assignment in one query
        assignment_ids = [a.id for a in assignments]
        flagged_counts = dict(
            SimilarityMatch.objects
            .filter(
                report__assignment_id__in=assignment_ids,
                ai_moss_flag=True,
            )
            .values('report__assignment_id')
            .annotate(cnt=Count('id'))
            .values_list('report__assignment_id', 'cnt')
        )

        return [
            {
                'id':               a.id,
                'title':            a.title,
                'subject':          a.subject.code,
                'submission_count': a.submission_count,
                'flagged_count':    flagged_counts.get(a.id, 0),
                'avg_score':        round(a.avg_score, 1) if a.avg_score else None,
                'due_date':         a.deadline,
            }
            for a in assignments
        ]
