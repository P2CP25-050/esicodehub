from django.shortcuts import render
from django.http import JsonResponse

# Create your views here.
def health_check(request):
    return JsonResponse({"status": "ok", "message": "Django is running"})

from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def send_test_data(request):
    return Response({
        "data": "Hello from django backend"
    })
