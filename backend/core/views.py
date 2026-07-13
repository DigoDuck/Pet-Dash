from datetime import date

from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import models, serializers, services


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
        qs = models.Pet.objects.filter(ativo=True).select_related("tutor").order_by("nome")
        return services.anota_vip(qs, date.today())

    def perform_destroy(self, instance):
        instance.ativo = False
        instance.save()

    @action(detail=True, methods=["get"], url_path="pacote-ativo")
    def pacote_ativo(self, request, pk=None):
        competencia_param = request.query_params.get("competencia")
        if competencia_param:
            competencia = date.fromisoformat(competencia_param).replace(day=1)
        else:
            competencia = date.today().replace(day=1)

        pacote = models.PacoteContratado.objects.filter(
            pet_id=pk, competencia=competencia, ativo=True
        ).first()
        if pacote is None:
            return Response(status=204)
        return Response(serializers.PacoteContratadoSerializer(pacote).data)


class ServicoViewSet(viewsets.ModelViewSet):
    serializer_class = serializers.ServicoSerializer
    search_fields = ["nome"]
    filterset_fields = ["is_pacote", "ativo"]
    queryset = models.Servico.objects.all().order_by("nome")


class PacoteContratadoViewSet(viewsets.ModelViewSet):
    serializer_class = serializers.PacoteContratadoSerializer
    filterset_fields = ["pet", "competencia"]
    search_fields = ["pet__nome", "pet__tutor__nome"]
    # select_related: sem ele, os *_nome do serializer fazem uma query por linha.
    # Desempate por pet__nome mantém a paginação estável dentro do mesmo mês.
    queryset = (
        models.PacoteContratado.objects
        .select_related("pet", "pet__tutor", "servico")
        .order_by("-competencia", "pet__nome")
    )


class CustoViewSet(viewsets.ModelViewSet):
    serializer_class = serializers.CustoSerializer
    filterset_fields = ["tipo", "competencia"]
    # Desempate por descrição: ordenar só pelo mês deixa as linhas do mesmo mês
    # em ordem indefinida, e a paginação passa a repetir ou pular lançamentos.
    queryset = models.Custo.objects.all().order_by("-competencia", "descricao")


class RetiradaViewSet(viewsets.ModelViewSet):
    serializer_class = serializers.RetiradaSerializer
    # Retirada tem data real, não competência: a tela do mês filtra por intervalo.
    # "exact" continua declarado — um filtro não declarado é ignorado em silêncio
    # pelo django-filter, e ?data=<dia> passaria a devolver todas as retiradas.
    filterset_fields = {"data": ["exact", "gte", "lte"]}
    queryset = models.Retirada.objects.all().order_by("-data", "descricao")


class DashboardView(APIView):
    def get(self, request):
        try:
            inicio = date.fromisoformat(request.query_params["inicio"])
            fim = date.fromisoformat(request.query_params["fim"])
        except KeyError:
            return Response(
                {"detail": "Parâmetros obrigatórios: inicio e fim (YYYY-MM-DD)."}, status=400
            )
        except ValueError:
            return Response(
                {"detail": "Data inválida; use o formato YYYY-MM-DD."}, status=400
            )

        kpis = serializers.DashboardSerializer(services.dashboard_periodo(inicio, fim)).data
        vip = serializers.PetSerializer(services.pets_vip(inicio, fim), many=True).data
        top = serializers.TopTutorSerializer(services.top_tutores(inicio, fim), many=True).data

        return Response({**kpis, "vip": vip, "top_tutores": top})


class AtendimentoViewSet(viewsets.ModelViewSet):
    serializer_class = serializers.AtendimentoSerializer
    filterset_fields = ["status", "pet", "data", "pacote"]
    ordering_fields = ["data", "horario"]

    def get_queryset(self):
        return (
            models.Atendimento.objects.select_related("pet__tutor", "servico", "pacote")
            .prefetch_related("pagamentos")
            .order_by("-data", "-horario")
        )
