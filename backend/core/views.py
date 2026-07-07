from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from . import models, serializers


@api_view(["GET"])
@permission_classes([AllowAny])
def healthcheck(request):
    return Response({"status": "ok"})


class TutorViewSet(viewsets.ModelViewSet):
    serializer_class = serializers.TutorSerializer
    search_fields = ["nome", "telefone"]

    def get_queryset(self):
        return models.Tutor.objects.filter(ativo=True).order_by("nome")

    def perform_destroy(self, instance):
        instance.ativo = False
        instance.save()
