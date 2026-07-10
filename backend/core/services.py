from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce

from core.models import Atendimento, Custo, PacoteContratado, Pet, Retirada, Tutor

VIP_MIN_VISITAS = 3
VIP_MIN_GASTO = Decimal("500")
VIP_JANELA_DIAS = 365


def faturamento_periodo(inicio, fim):
    pacotes = PacoteContratado.objects.filter(
        data_compra__gte=inicio, data_compra__lte=fim
    ).aggregate(total=Sum("valor_pago"))["total"] or Decimal("0")

    avulsos = (
        Atendimento.objects.avulsos().liberados().no_periodo(inicio, fim)
        .aggregate(total=Sum("valor"))["total"]
        or Decimal("0")
)

    return pacotes + avulsos

def dashboard_periodo(inicio, fim):
    """KPIs financeiros do período, em regime de caixa.

    - faturamento: reusa faturamento_periodo (pacotes por data_compra + avulsos
      Liberados por data).
    - custos: soma de Custo.valor com competencia dentro do intervalo. Assume
      períodos alinhados a meses fechados (competencia é sempre dia 1); num
      intervalo quebrado (ex.: 15/06–15/07) a competência de junho fica fora.
    - retiradas: soma por data no intervalo. Não entram no lucro — retirada é
      distribuição de lucro, não despesa.
    - ticket_medio: faturamento / nº de eventos de receita, onde 1 pacote
      vendido = 1 evento e 1 avulso Liberado = 1 evento (coerente com o
      faturamento; consumo de pacote não conta). 2 casas decimais.
    - margem: lucro / faturamento, fração 0–1 com 4 casas decimais.
    """
    faturamento = faturamento_periodo(inicio, fim)
    
    custos = Custo.objects.filter(
        competencia__range=(inicio, fim) 
    ).aggregate(total=Sum("valor"))["total"] or Decimal("0")
    
    retiradas = Retirada.objects.filter(
        data__gte=inicio, data__lte=fim
    ).aggregate(total=Sum("valor"))["total"] or Decimal("0")
    
    lucro = faturamento - custos
    
    qtd_avulsos = Atendimento.objects.avulsos().liberados().no_periodo(inicio, fim).count()
    qtd_pacotes = PacoteContratado.objects.filter(data_compra__range=(inicio, fim)).count()
    qtd_atendimentos = qtd_avulsos + qtd_pacotes

    ticket_medio = (
        (faturamento / qtd_atendimentos).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if qtd_atendimentos
        else Decimal("0")
    )
    margem = (
        (lucro / faturamento).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        if faturamento
        else Decimal("0")
    )
    
    return {
        "faturamento": faturamento,
        "custos": custos,
        "retiradas": retiradas,
        "lucro": lucro,
        "ticket_medio": ticket_medio,
        "margem": margem,
    }
    

def pets_vip(inicio, fim):
    """Pets VIP no período: 3+ visitas Liberadas OU R$500+ gastos.

    Consumo de pacote conta como visita (invariante: frequência/VIP). Pets
    inativos (soft-delete) ficam fora da vitrine do dashboard.
    """
    return (
        Pet.objects.filter(
            ativo=True,
            atendimentos__status=Atendimento.Status.LIBERADO,
            atendimentos__data__range=(inicio, fim),
        )
        .select_related("tutor")
        .annotate(
            qtd_visitas=Count("atendimentos"),
            total_gasto=Sum("atendimentos__valor"),
        )
        .filter(Q(qtd_visitas__gte=3) | Q(total_gasto__gte=500))
        .distinct()
    )


def anota_vip(queryset, hoje):
    """Anota qtd_visitas e total_gasto de cada pet na janela de 365 dias até `hoje`.

    A agregação é condicional (`filter=` dentro do Count/Sum), e não um
    `.filter()` sobre o queryset, de propósito: filtrar o join transformaria o
    LEFT OUTER em INNER e pets sem atendimento sumiriam da lista de clientes.

    Count e Sum percorrem uma única relação (`atendimentos`), então não se
    multiplicam. Ao acrescentar uma segunda relação a esta annotate, aparece
    produto cartesiano: separe em duas queries.

    O booleano `vip` é derivado no PetSerializer a partir destes dois números,
    e não anotado aqui, para que o dashboard (que serializa `pets_vip`, com
    outra janela) continue coerente sem duplicar a regra.

    `hoje` é parâmetro, não `date.today()`, para o teste ser determinístico.
    """
    na_janela = Q(
        atendimentos__status=Atendimento.Status.LIBERADO,
        atendimentos__data__gte=hoje - timedelta(days=VIP_JANELA_DIAS),
        atendimentos__data__lte=hoje,
    )
    return queryset.annotate(
        qtd_visitas=Count("atendimentos", filter=na_janela),
        total_gasto=Coalesce(
            Sum("atendimentos__valor", filter=na_janela),
            Value(Decimal("0")),
            output_field=DecimalField(max_digits=10, decimal_places=2),
        ),
    )


def top_tutores(inicio, fim, limite=5):
    """Tutores por gasto total no período (mitiga o ponto cego do VIP por pet).

    Tutores inativos (soft-delete) ficam fora.
    """
    return (
        Tutor.objects.filter(
            ativo=True,
            pets__atendimentos__status=Atendimento.Status.LIBERADO,
            pets__atendimentos__data__range=(inicio, fim),
        )
        .annotate(gasto_total=Sum("pets__atendimentos__valor"))
        .order_by("-gasto_total")[:limite]
    )