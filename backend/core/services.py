from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import (
    Case,
    Count,
    DecimalField,
    F,
    Min,
    OuterRef,
    Q,
    Subquery,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Coalesce, Lower, Trim

from core.models import Atendimento, Custo, PacoteContratado, Pet, Retirada, Tutor

VIP_MIN_VISITAS = 3
VIP_MIN_GASTO = Decimal("500")
VIP_JANELA_DIAS = 365
CATEGORIAS_NO_GRAFICO = 5
TRANSACOES_NO_FEED = 8


def transporte_periodo(inicio, fim):
    """Receita das corridas: soma de `transporte_valor` de TODO atendimento Liberado.

    Inclui o consumo de pacote de propósito. O banho do pacote já foi pago na venda,
    mas a corrida até a casa da tutora não — ela é cobrada por viagem, à parte da
    cota. Restringir isto a avulsos perderia a corrida de todo pet com pacote, que é
    justamente a cliente mais frequente.

    Confere com a planilha da Patricia somando só os Liberados: mai/2026 R$ 977,00 ·
    jun/2026 R$ 1.595,50 · jul/2026 R$ 710,00.
    """
    return Atendimento.objects.liberados().no_periodo(inicio, fim).aggregate(
        total=Sum("transporte_valor")
    )["total"] or Decimal("0")


def faturamento_periodo(inicio, fim):
    """Regime de caixa: pacotes vendidos + serviços avulsos + corridas.

    O transporte entra porque o custo dele já entrava. O sistema contabilizava a
    manutenção do triciclo e o combustível como custo, e ignorava a receita da
    corrida — contava a despesa e não a receita da mesma coisa, subestimando o lucro.

    A invariante 1 continua de pé no que importa: o `valor` do consumo de pacote
    segue fora do faturamento (é o `pacote_id`, não o valor zero, que o exclui).
    """
    pacotes = PacoteContratado.objects.filter(
        data_compra__gte=inicio, data_compra__lte=fim
    ).aggregate(total=Sum("valor_pago"))["total"] or Decimal("0")

    avulsos = (
        Atendimento.objects.avulsos().liberados().no_periodo(inicio, fim)
        .aggregate(total=Sum("valor"))["total"]
        or Decimal("0")
    )

    return pacotes + avulsos + transporte_periodo(inicio, fim)

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
    - qtd_atendimentos: VISITAS Liberadas no período, incluindo consumo de pacote.
      É um número diferente de `qtd_eventos_receita` (o denominador do ticket) e
      os dois precisam continuar diferentes: o 2º banho do pacote é uma visita
      (invariante 2: conta em frequência e histórico) mas não é receita nova.
      Unificar os dois dividiria o faturamento pelo número errado.
    - pets_ativos: contagem do cadastro, não do período. Viaja aqui por caber no
      mesmo payload da tela que a exibe.
    - transporte: a parcela do faturamento que veio das corridas. Sai em separado
      porque é o número que concilia com a planilha da Patricia, e porque ela quer
      saber se o triciclo se paga (a receita da corrida contra o combustível).
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
    qtd_eventos_receita = qtd_avulsos + qtd_pacotes

    ticket_medio = (
        (faturamento / qtd_eventos_receita).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if qtd_eventos_receita
        else Decimal("0")
    )
    margem = (
        (lucro / faturamento).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        if faturamento
        else Decimal("0")
    )

    return {
        "faturamento": faturamento,
        "transporte": transporte_periodo(inicio, fim),
        "custos": custos,
        "retiradas": retiradas,
        "lucro": lucro,
        "ticket_medio": ticket_medio,
        "margem": margem,
        "qtd_atendimentos": Atendimento.objects.liberados().no_periodo(inicio, fim).count(),
        "pets_ativos": Pet.objects.filter(ativo=True).count(),
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


def transacoes_recentes(inicio, fim, limite=TRANSACOES_NO_FEED):
    """Feed de caixa do período, mais recente primeiro.

    Um atendimento entra se trouxe dinheiro, e pelo dinheiro que trouxe. É uma regra
    só, e ela resolve os três casos:

    - avulso: trouxe o serviço mais a corrida (`valor + transporte_valor`);
    - consumo de pacote COM corrida: trouxe só a corrida (o banho foi pago na venda);
    - consumo de pacote sem corrida: não trouxe nada, e fica fora.

    O `valor` do consumo nunca entra — é a invariante 1. Mostrá-lo como "+R$ 95,00"
    criaria receita que não existe, o mesmo faturar-em-dobro de sempre, agora pela
    porta do design.

    A anotação `receita` faz esse recorte no banco, e não em Python, porque o slice
    `[:limite]` acontece na query: filtrar depois devolveria menos de 8 linhas.

    Quatro querysets já fatiados no banco e ordenados em Python, em vez de um UNION.
    O UNION exigiria homogeneizar quatro models heterogêneos com `Value()` anotado e
    reescreveria a regra numa segunda sintaxe — tudo isso para ordenar 32 linhas.

    Empate de data é resolvido pela ordem fixa da concatenação (receitas antes de
    despesas no mesmo dia), porque o `sorted` do Python é estável.
    """
    receita_do_atendimento = Case(
        When(pacote__isnull=True, then=F("valor") + F("transporte_valor")),
        default=F("transporte_valor"),
        output_field=DecimalField(max_digits=10, decimal_places=2),
    )
    atendimentos = [
        {
            "tipo": "atendimento",
            "descricao": f"{a.servico.nome} · {a.pet.nome}",
            "valor": a.receita,
            "data": a.data,
        }
        for a in (
            Atendimento.objects.liberados().no_periodo(inicio, fim)
            .annotate(receita=receita_do_atendimento)
            .filter(receita__gt=0)
            .select_related("servico", "pet")
            .order_by("-data", "-id")[:limite]
        )
    ]
    pacotes = [
        {
            "tipo": "pacote",
            "descricao": f"{p.servico.nome} · {p.pet.nome}",
            "valor": p.valor_pago,
            "data": p.data_compra,
        }
        for p in (
            PacoteContratado.objects.filter(data_compra__range=(inicio, fim))
            .select_related("servico", "pet")
            .order_by("-data_compra", "-id")[:limite]
        )
    ]
    custos = [
        {"tipo": "custo", "descricao": c.descricao, "valor": c.valor, "data": c.competencia}
        for c in (
            Custo.objects.filter(competencia__range=(inicio, fim))
            .order_by("-competencia", "-id")[:limite]
        )
    ]
    retiradas = [
        {"tipo": "retirada", "descricao": r.descricao, "valor": r.valor, "data": r.data}
        for r in (
            Retirada.objects.filter(data__range=(inicio, fim)).order_by("-data", "-id")[:limite]
        )
    ]

    tudo = atendimentos + pacotes + retiradas + custos
    return sorted(tudo, key=lambda t: t["data"], reverse=True)[:limite]


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
        .filter(Q(qtd_visitas__gte=VIP_MIN_VISITAS) | Q(total_gasto__gte=VIP_MIN_GASTO))
        .distinct()
    )


def eh_vip(qtd_visitas, total_gasto):
    """A regra da invariante 6, num lugar só: 3+ visitas OU R$ 500+ gastos.

    Vive aqui, e não no serializer, porque agora dois serializers a aplicam (o do Pet e
    o do Atendimento) — e uma regra de negócio duplicada diverge no dia em que o critério
    da Patricia mudar.
    """
    return qtd_visitas >= VIP_MIN_VISITAS or (total_gasto or Decimal("0")) >= VIP_MIN_GASTO


def _janela_vip(hoje, prefixo=""):
    """O que conta como visita VIP, num lugar só: Liberado, nos 365 dias até `hoje`.

    `prefixo` adapta o mesmo filtro ao model consultado: vazio num queryset de
    Atendimento, "atendimentos__" num de Pet. Duas cópias da janela divergiriam em
    silêncio no dia em que o critério mudar — o badge da agenda diria uma coisa e a
    lista de clientes outra, para o mesmo pet.
    """
    return Q(**{
        f"{prefixo}status": Atendimento.Status.LIBERADO,
        f"{prefixo}data__gte": hoje - timedelta(days=VIP_JANELA_DIAS),
        f"{prefixo}data__lte": hoje,
    })


def anota_vip_do_pet(queryset, hoje):
    """Anota, num queryset de ATENDIMENTO, as visitas e o gasto do pet na janela VIP.

    Subquery e não SerializerMethodField: a agenda lista uma semana inteira (~33 linhas)
    e cada linha faria dois COUNT/SUM próprios. Aqui é uma query só, seja qual for o
    tamanho da lista.
    """
    do_pet = (
        Atendimento.objects.filter(_janela_vip(hoje), pet=OuterRef("pet"))
        .values("pet")
        .annotate(visitas=Count("id"), gasto=Sum("valor"))
    )
    return queryset.annotate(
        pet_visitas=Subquery(do_pet.values("visitas")[:1]),
        pet_gasto=Subquery(do_pet.values("gasto")[:1]),
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
    na_janela = _janela_vip(hoje, prefixo="atendimentos__")
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