"""Views for the assignment_submissions app."""

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.esi_db.models import EsiStudent

from .models import Assignment
from .serializers import (
    AssignmentCreateSerializer,
    AssignmentDetailSerializer,
    AssignmentListSerializer,
)


def delete_assignment_directory(prefix):
    """Delete all files under one assignment GCS prefix."""
    # Import lazily so this module can load even when optional GCS deps
    # are not installed in lightweight/local environments.
    from apps.personal_submissions.gcs import delete_directory

    delete_directory(prefix)


def assignment_matches_student_targeting(assignment, esi_student):
    """Return True when assignment targeting matches one ESI student."""
    if assignment.target_year != esi_student.study_year:
        return False

    if assignment.target_sections:
        section = (esi_student.section or '').strip()
        target_sections = {
            str(value).strip() for value in assignment.target_sections
        }
        if section not in target_sections:
            return False

    if assignment.target_groups:
        student_group = str(esi_student.group)
        target_groups = {
            str(value).strip() for value in assignment.target_groups
        }
        if student_group not in target_groups:
            return False

    return True


def student_is_targeted(assignment, user):
    """Return True when the given student user is targeted."""
    if user.role != 'student' or not user.school_id:
        return False

    try:
        esi_student = EsiStudent.objects.get(school_id=user.school_id)
    except EsiStudent.DoesNotExist:
        return False

    return assignment_matches_student_targeting(assignment, esi_student)


class AssignmentListPagination(PageNumberPagination):
    """Pagination used for assignments listing."""

    page_size = 20


class AssignmentListCreateView(APIView):
    """List assignments and allow professors to create assignments."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Assignment.objects.select_related(
            'subject',
            'professor',
        ).all()

        if request.user.role == 'professor':
            queryset = queryset.filter(professor=request.user)
            group_filter = request.query_params.get('group')

            if group_filter:
                group_value = group_filter.strip()
                filtered = [
                    assignment
                    for assignment in queryset
                    if group_value
                    in {
                        str(value).strip()
                        for value in assignment.target_groups
                    }
                ]
                queryset = filtered
        elif request.user.role == 'student':
            if not request.user.school_id:
                queryset = Assignment.objects.none()
            else:
                esi_student = EsiStudent.objects.filter(
                    school_id=request.user.school_id,
                ).first()

                if not esi_student:
                    queryset = Assignment.objects.none()
                else:
                    queryset = queryset.filter(
                        target_year=esi_student.study_year,
                    )
                    queryset = [
                        assignment
                        for assignment in queryset
                        if assignment_matches_student_targeting(
                            assignment,
                            esi_student,
                        )
                    ]
        else:
            return Response(
                {
                    'detail': (
                        'You do not have permission to perform this action.'
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        paginator = AssignmentListPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = AssignmentListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        if request.user.role != 'professor':
            return Response(
                {
                    'detail': (
                        'You do not have permission to perform this action.'
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AssignmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = serializer.save(professor=request.user)

        detail_serializer = AssignmentDetailSerializer(assignment)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)


class AssignmentDetailView(APIView):
    """Retrieve, update and delete a single assignment."""

    permission_classes = [IsAuthenticated]
    updatable_fields = {'title', 'description', 'deadline', 'allow_late'}
    immutable_fields = {
        'target_year',
        'target_sections',
        'target_groups',
        'subject',
    }

    def get_object(self, pk):
        return get_object_or_404(
            Assignment.objects.select_related(
                'subject',
                'professor',
            ),
            pk=pk,
        )

    def get(self, request, pk):
        assignment = self.get_object(pk)

        if request.user.role == 'professor' or student_is_targeted(
            assignment,
            request.user,
        ):
            serializer = AssignmentDetailSerializer(assignment)
            return Response(serializer.data)

        return Response(
            {'detail': 'You do not have permission to perform this action.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    def patch(self, request, pk):
        assignment = self.get_object(pk)

        if assignment.professor != request.user:
            return Response(
                {
                    'detail': (
                        'You do not have permission to perform this action.'
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        incoming_fields = set(request.data.keys())
        if incoming_fields & self.immutable_fields:
            return Response(
                {
                    'detail': (
                        'Fields target_year, target_sections, target_groups '
                        'and subject cannot be updated.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        disallowed_fields = incoming_fields - self.updatable_fields
        if disallowed_fields:
            return Response(
                {
                    'detail': (
                        'Only title, description, deadline and allow_late '
                        'can be updated.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AssignmentCreateSerializer(
            assignment,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        updated_assignment = serializer.save()

        detail_serializer = AssignmentDetailSerializer(updated_assignment)
        return Response(detail_serializer.data)

    def delete(self, request, pk):
        assignment = self.get_object(pk)

        if assignment.professor != request.user:
            return Response(
                {
                    'detail': (
                        'You do not have permission to perform this action.'
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        delete_assignment_directory(f'assignments/{assignment.id}/')
        assignment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
