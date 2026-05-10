from django.db.models import Count, Q
from apps.accounts.models import User


def _build_avatar(user):
    profile = getattr(user, 'profile', None)
    if profile and profile.avatar_data and profile.avatar_content_type:
        return f"data:{profile.avatar_content_type};base64,{profile.avatar_data}"
    return None


def get_forum_leaderboard():
    """
    Return top 10 questioners and top 10 answerers among students.
    Shared between student and professor insights endpoints.
    """
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
                'school_id':      u.school_id,
                'first_name':     u.first_name,
                'last_name':      u.last_name,
                'avatar':         _build_avatar(u),
                'answer_count':   u.answer_count,
                'accepted_count': u.accepted_count,
            }
            for u in top_answerers
        ],
    }
