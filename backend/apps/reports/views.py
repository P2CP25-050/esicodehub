from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .serializers import UserReportSerializer, ProblemReportSerializer
from .tasks import notify_admin_user_report, notify_admin_problem_report


class UserReportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UserReportSerializer(
            data=request.data,
            context={'request': request}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        report = serializer.save()
        notify_admin_user_report.delay(report.id)

        return Response(
            {"message": "Report submitted. Our team will review it shortly."},
            status=status.HTTP_201_CREATED
        )


class ProblemReportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ProblemReportSerializer(
            data=request.data,
            context={'request': request}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        report = serializer.save()
        notify_admin_problem_report.delay(report.id)

        return Response(
            {"message": "Thank you for the report. We'll look into it."},
            status=status.HTTP_201_CREATED
        )
