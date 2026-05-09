from django.db.models import Count, Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.assignment_submissions.models import Assignment, AssignmentSubmission
from apps.forum.models import Answer, Question
from apps.personal_submissions.models import PersonalSubmission


def _build_avatar(user):
    """Return a base64 data URL for the user's avatar, or None."""
    profile = getattr(user, 'profile', None)
    if profile and profile.avatar_data and profile.avatar_content_type:
        return f"data:{profile.avatar_content_type};base64,{profile.avatar_data}"
    return None


def _get_esi_record(user):
    """Return the EsiStudent record for this user, or None if not found."""
    from apps.esi_db.models import EsiStudent
    try:
        return EsiStudent.objects.get(school_id=user.school_id)
    except EsiStudent.DoesNotExist:
        return None


def _filter_targeted(assignments, esi):
    """
    Filter a list of Assignment objects down to those that target
    this student's section and group.
    Empty target_sections / target_groups means "all".
    """
    result = []
    for assignment in assignments:
        if assignment.target_sections and esi.section not in assignment.target_sections:
            continue
        if assignment.target_groups and esi.group not in assignment.target_groups:
            continue
        result.append(assignment)
    return result


class StudentInsightsView(APIView):
    """
    GET /api/insights/student/

    Returns leaderboard, recent assignments, recent personal submissions,
    and personal stats for the requesting student in a single call.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        return Response({
            'leaderboard':          self._leaderboard(),
            'recent_assignments':   self._recent_assignments(user),
            'recent_submissions':   self._recent_submissions(user),
            'personal_stats':       self._personal_stats(user),
        })

    # ------------------------------------------------------------------
    # Leaderboard
    # ------------------------------------------------------------------

    def _leaderboard(self):
        top_questioners = (
            User.objects
            .filter(role=User.Role.STUDENT)
            .select_related('profile')
            .annotate(question_count=Count('questions'))
            .order_by('-question_count')[:10]
        )

        top_answerers = (
            User.objects
            .filter(role=User.Role.STUDENT)
            .select_related('profile')
            .annotate(
                answer_count=Count('forum_answers'),
                accepted_count=Count(
                    'forum_answers',
                    filter=Q(forum_answers__is_accepted=True),
                ),
            )
            .order_by('-answer_count')[:10]
        )

        return {
            'top_questioners': [
                {
                    'school_id':      u.school_id,
                    'first_name':     u.first_name,
                    'last_name':      u.last_name,
                    'avatar':         _build_avatar(u),
                    'question_count': u.question_count,
                }
                for u in top_questioners
            ],
            'top_answerers': [
                {
                    'school_id':     u.school_id,
                    'first_name':    u.first_name,
                    'last_name':     u.last_name,
                    'avatar':        _build_avatar(u),
                    'answer_count':  u.answer_count,
                    'accepted_count': u.accepted_count,
                }
                for u in top_answerers
            ],
        }

    # ------------------------------------------------------------------
    # Recent assignments
    # ------------------------------------------------------------------

    def _recent_assignments(self, user):
        """5 nearest upcoming deadlines that target this student."""
        esi = _get_esi_record(user)
        if esi is None:
            return []

        # Fetch all assignments for this student's year, sorted by deadline
        assignments = list(
            Assignment.objects
            .filter(target_year=esi.study_year)
            .select_related('subject')
            .order_by('deadline')
        )

        targeted = _filter_targeted(assignments, esi)

        # IDs the student has already submitted
        submitted_ids = set(
            AssignmentSubmission.objects
            .filter(student=user)
            .values_list('assignment_id', flat=True)
        )

        return [
            {
                'id':           a.id,
                'title':        a.title,
                'subject':      a.subject.code,
                'due_date':     a.deadline,
                'has_submitted': a.id in submitted_ids,
                'is_open':      a.is_open_for_submission(),
            }
            for a in targeted[:5]
        ]

    # ------------------------------------------------------------------
    # Recent personal submissions
    # ------------------------------------------------------------------

    def _recent_submissions(self, user):
        """5 most recent personal submissions by this student."""
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

    # ------------------------------------------------------------------
    # Personal stats
    # ------------------------------------------------------------------

    def _personal_stats(self, user):
        """Aggregated counts for this student's activity."""
        esi = _get_esi_record(user)

        # Assignments the student has already submitted
        submitted_ids = set(
            AssignmentSubmission.objects
            .filter(student=user)
            .values_list('assignment_id', flat=True)
        )

        # Open targeted assignments the student has NOT yet submitted
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
