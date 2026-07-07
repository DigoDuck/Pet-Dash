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


class PetViewSet(viewsets.ModelViewSet):
    serializer_class = serializers.PetSerializer
    search_fields = ["nome", "tutor__nome"]
    filterset_fields = ["tutor", "porte"]

    def get_queryset(self):
        return models.Pet.objects.filter(ativo=True).select_related("tutor").order_by("nome")

    def perform_destroy(self, instance):
        instance.ativo = False
        instance.save()


class ServicoViewSet(viewsets.ModelViewSet):
    serializer_class = serializers.ServicoSerializer
    search_fields = ["nome"]
    filterset_fields = ["is_pacote", "ativo"]
    queryset = models.Servico.objects.all().order_by("nome")


class AtendimentoViewSet(viewsets.ModelViewSet):
    serializer_class = serializers.AtendimentoSerializer
    filterset_fields = ["status", "pet", "data", "pacote"]
    ordering_fields = ["data", "horario"]

    def get_queryset(self):
        return (
            models.Atendimento.objects.select_related("pet", "servico", "pacote")
            .prefetch_related("pagamentos")
            .order_by("-data", "-horario")
        )
