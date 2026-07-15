from datetime import date

from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ParseError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import models, serializers, services


@api_view(["GET"])
@permission_classes([AllowAny])
def healthcheck(request):
    return Response({"status": "ok"})


def periodo_dos_params(request):
    """Lê ?inicio=&fim= no formato ISO. ParseError vira 400 com {"detail": ...}."""
    try:
        return (
            date.fromisoformat(request.query_params["inicio"]),
            date.fromisoformat(request.query_params["fim"]),
        )
    except KeyError as erro:
        raise ParseError("Parâmetros obrigatórios: inicio e fim (YYYY-MM-DD).") from erro
    except ValueError as erro:
        raise ParseError("Data inválida; use o formato YYYY-MM-DD.") from erro


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
            try:
                competencia = date.fromisoformat(competencia_param).replace(day=1)
            except ValueError as erro:
                # Sem o try, uma competência malformada estourava 500. O formulário de
                # atendimento passou a mandar esse parâmetro em toda busca de pacote,
                # então o caminho deixou de ser hipotético.
                raise ParseError("Data inválida; use o formato YYYY-MM-DD.") from erro
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
        inicio, fim = periodo_dos_params(request)

        kpis = serializers.DashboardSerializer(services.dashboard_periodo(inicio, fim)).data
        vip = serializers.PetSerializer(services.pets_vip(inicio, fim), many=True).data
        top = serializers.TopTutorSerializer(services.top_tutores(inicio, fim), many=True).data
        categorias = serializers.CategoriaCustoSerializer(
            services.custos_por_categoria(inicio, fim), many=True
        ).data

        return Response(
            {**kpis, "vip": vip, "top_tutores": top, "custos_por_categoria": categorias}
        )


class TransacoesRecentesView(APIView):
    def get(self, request):
        inicio, fim = periodo_dos_params(request)
        transacoes = services.transacoes_recentes(inicio, fim)
        return Response(serializers.TransacaoSerializer(transacoes, many=True).data)


class SerieMensalView(APIView):
    """Rota própria, e não mais um campo do /dashboard/, porque a série custa 3
    queries por mês. Embutida no /dashboard/, a página Financeiro — que só quer dois
    totais — passaria a pagar o gráfico inteiro a cada troca de mês."""

    # A série faz 3 queries POR MÊS do intervalo. Sem teto, um `?inicio=0202-01-01`
    # (ISO válido) gera dezenas de milhares de meses e trava o worker até o timeout —
    # a Railway roda num plano barato. O gráfico pede 6 meses; 24 é folga generosa.
    MAX_MESES = 24

    def get(self, request):
        inicio, fim = periodo_dos_params(request)

        meses = (fim.year - inicio.year) * 12 + (fim.month - inicio.month) + 1
        if meses > self.MAX_MESES:
            raise ParseError(f"Intervalo longo demais: máximo de {self.MAX_MESES} meses.")

        serie = services.serie_mensal(inicio, fim)
        return Response(serializers.PontoSerieSerializer(serie, many=True).data)


class AtendimentoViewSet(viewsets.ModelViewSet):
    serializer_class = serializers.AtendimentoSerializer
    # `gte`/`lte` em `data` para a agenda pedir uma semana. O `exact` fica: o filtro do
    # dia na lista de atendimentos depende dele, e um lookup não declarado é ignorado em
    # silêncio pelo django-filter (?data=<dia> passaria a devolver tudo).
    filterset_fields = {
        "data": ["exact", "gte", "lte"],
        "status": ["exact"],
        "pet": ["exact"],
        "pacote": ["exact"],
    }
    ordering_fields = ["data", "horario"]

    def get_queryset(self):
        qs = (
            models.Atendimento.objects.select_related("pet__tutor", "servico", "pacote")
            .prefetch_related("pagamentos")
            .order_by("-data", "-horario")
        )
        return services.anota_vip_do_pet(qs, date.today())

    # O objeto salvo não passa pelo get_queryset() anotado (POST) ou carrega a
    # anotação de ANTES do save (PATCH que muda status podia cruzar o limiar VIP
    # e responder com o valor velho). Re-buscar do queryset anotado deixa a
    # resposta de escrita igual à do GET seguinte.
    def _reanota(self, serializer):
        serializer.instance = self.get_queryset().get(pk=serializer.instance.pk)

    def perform_create(self, serializer):
        serializer.save()
        self._reanota(serializer)

    def perform_update(self, serializer):
        serializer.save()
        self._reanota(serializer)
