from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Count, DecimalField, Min, Q, Sum, Value
from django.db.models.functions import Coalesce, Lower, Trim

from core.models import Atendimento, Custo, PacoteContratado, Pet, Retirada, Tutor

VIP_MIN_VISITAS = 3
VIP_MIN_GASTO = Decimal("500")
VIP_JANELA_DIAS = 365
CATEGORIAS_NO_GRAFICO = 5


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
    

def _primeiro_dia_do_proximo_mes(competencia):
    """Dezembro é o caso que quebra a versão ingênua (mes + 1 estoura em 13)."""
    if competencia.month == 12:
        return date(competencia.year + 1, 1, 1)
    return date(competencia.year, competencia.month + 1, 1)


def serie_mensal(inicio, fim):
    """Faturamento, custos e lucro de cada mês do intervalo, em ordem cronológica.

    Reusa `faturamento_periodo` mês a mês em vez de fazer um TruncMonth com um
    GROUP BY só. São 3 queries por mês (18 num gráfico de 6) contra 3 no total —
    mas o GROUP BY reescreveria a regra da invariante 1 (`pacote_id IS NULL` +
    status Liberado + pacotes por `data_compra`) num segundo lugar. Com regra
    duplicada, uma mudança futura em só um dos lados faz o gráfico e o KPI da
    mesma tela discordarem em silêncio. Com usuária única e ~130 atendimentos/mês,
    18 queries indexadas não são um problema; duas cópias da regra são.
    `test_serie_bate_com_dashboard_periodo_no_mesmo_mes` guarda essa decisão.

    Itera sobre os meses do intervalo, e não sobre as linhas do banco: mês sem
    movimento precisa aparecer como linha de zeros. Se ele sumisse, o gráfico
    colaria abril em junho e a leitura de tendência mentiria.

    Cada ponto cobre o mês inteiro, mesmo que o intervalo pedido comece ou termine
    no meio dele — uma barra é sempre um mês fechado.
    """
    pontos = []
    competencia = inicio.replace(day=1)
    ultima = fim.replace(day=1)

    while competencia <= ultima:
        fim_do_mes = _primeiro_dia_do_proximo_mes(competencia) - timedelta(days=1)

        faturamento = faturamento_periodo(competencia, fim_do_mes)
        custos = Custo.objects.filter(competencia=competencia).aggregate(
            total=Sum("valor")
        )["total"] or Decimal("0")

        pontos.append({
            "competencia": competencia,
            "faturamento": faturamento,
            "custos": custos,
            "lucro": faturamento - custos,
        })
        competencia = _primeiro_dia_do_proximo_mes(competencia)

    return pontos


def custos_por_categoria(inicio, fim, limite=CATEGORIAS_NO_GRAFICO):
    """Custos do período agrupados por categoria, maiores primeiro, cauda em "Outros".

    `Custo.categoria` é texto livre (CharField, sem choices, aceita vazio), então o
    GROUP BY é feito numa chave normalizada: sem ela, "Aluguel", "aluguel" e
    "Aluguel " virariam três fatias do mesmo aluguel e o gráfico mentiria. O rótulo
    exibido continua sendo o texto como foi digitado — só a chave de agrupamento é
    normalizada. Custo sem categoria vira "Sem categoria" em vez de uma fatia anônima.

    Isso não conserta o problema na origem (a categoria continua sem catálogo);
    apenas impede que a digitação suja apareça como custo duplicado.
    """
    grupos = (
        Custo.objects.filter(competencia__range=(inicio, fim))
        .annotate(chave=Lower(Trim("categoria")))
        .values("chave")
        .annotate(total=Sum("valor"), rotulo=Min("categoria"))
        .order_by("-total")
    )

    linhas = [
        {
            "categoria": (grupo["rotulo"] or "").strip() or "Sem categoria",
            "valor": grupo["total"],
        }
        for grupo in grupos
    ]

    if len(linhas) <= limite:
        return linhas

    cauda = sum((linha["valor"] for linha in linhas[limite:]), Decimal("0"))
    return [*linhas[:limite], {"categoria": "Outros", "valor": cauda}]


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