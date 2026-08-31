"""O transporte é receita, e até agora era dado morto.

`transporte_valor` era gravado, nunca cobrado (a validação de pagamento ignorava),
nunca faturado (o faturamento somava só `valor`) e nunca conciliado. Enquanto isso,
o custo do triciclo (manutenção fixa + combustível) já entrava nos custos: o sistema
contava a despesa da corrida e não a receita dela, subestimando o lucro.

Oráculo: a planilha real da Patricia (`controle_financeiro_pet.xlsx`) soma o
transporte dos atendimentos Liberados no "Faturamento Bruto". Conferido mês a mês —
mai/2026 R$ 977,00 · jun/2026 R$ 1.595,50 · jul/2026 R$ 710,00.
"""

from datetime import date
from decimal import Decimal

import pytest

from core.services import (
    custo_transporte_periodo,
    dashboard_periodo,
    faturamento_periodo,
    transacoes_recentes,
)
from tests.factories import (
    AtendimentoFactory,
    CustoFactory,
    PacoteContratadoFactory,
    PetFactory,
    ServicoFactory,
)

pytestmark = pytest.mark.django_db


def test_faturamento_soma_o_transporte_do_avulso():
    AtendimentoFactory(
        valor=Decimal("65.00"), transporte=True, transporte_valor=Decimal("20.00"),
        data=date(2026, 6, 10), status="Liberado",
    )

    assert faturamento_periodo(date(2026, 6, 1), date(2026, 6, 30)) == Decimal("85.00")


def test_faturamento_soma_o_transporte_do_consumo_de_pacote():
    """O banho do pacote já foi pago; a corrida até a casa da tutora, não.

    Este é o teste que separa as duas coisas. O `valor` do consumo continua fora do
    faturamento (invariante 1 intacta), mas o `transporte_valor` entra — é dinheiro
    que a Patricia recebeu naquele dia, e a planilha dela sempre contou assim.
    """
    pacote = PacoteContratadoFactory(
        valor_pago=Decimal("290.00"),
        data_compra=date(2026, 6, 1),
        competencia=date(2026, 6, 1),
    )
    AtendimentoFactory(
        pet=pacote.pet, pacote=pacote, valor=Decimal("65.00"),
        transporte=True, transporte_valor=Decimal("20.00"),
        data=date(2026, 6, 10), status="Liberado",
    )

    # 290 do pacote + 20 da corrida. Os 65 do banho NÃO entram: já foram pagos.
    assert faturamento_periodo(date(2026, 6, 1), date(2026, 6, 30)) == Decimal("310.00")


def test_transporte_de_pendente_e_cancelado_nao_fatura():
    """Regime de caixa: só Liberado entrou dinheiro. Vale para a corrida também."""
    AtendimentoFactory(
        valor=Decimal("65.00"), transporte=True, transporte_valor=Decimal("20.00"),
        data=date(2026, 6, 10), status="Pendente",
    )
    AtendimentoFactory(
        valor=Decimal("65.00"), transporte=True, transporte_valor=Decimal("20.00"),
        data=date(2026, 6, 11), status="Cancelado",
    )

    assert faturamento_periodo(date(2026, 6, 1), date(2026, 6, 30)) == Decimal("0")


def test_atendimento_sem_transporte_nao_muda_nada():
    """Guarda de regressão: o caminho sem corrida continua exatamente como era."""
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 6, 10), status="Liberado")

    assert faturamento_periodo(date(2026, 6, 1), date(2026, 6, 30)) == Decimal("95.00")


def test_dashboard_expoe_o_transporte_em_separado():
    """O total de transporte é o campo que concilia com a planilha da Patricia."""
    AtendimentoFactory(
        valor=Decimal("65.00"), transporte=True, transporte_valor=Decimal("20.00"),
        data=date(2026, 6, 10), status="Liberado",
    )
    AtendimentoFactory(
        valor=Decimal("85.00"), transporte=True, transporte_valor=Decimal("7.50"),
        data=date(2026, 6, 12), status="Liberado",
    )

    kpis = dashboard_periodo(date(2026, 6, 1), date(2026, 6, 30))

    assert kpis["transporte"] == Decimal("27.50")
    assert kpis["faturamento"] == Decimal("177.50")  # 150 de serviço + 27,50 de corrida


def test_lucro_e_margem_sobem_com_o_transporte():
    """O ponto de tudo isso: o custo do triciclo já estava nos custos.

    Sem contar a receita da corrida, o lucro aparecia menor do que é.
    """
    AtendimentoFactory(
        valor=Decimal("100.00"), transporte=True, transporte_valor=Decimal("100.00"),
        data=date(2026, 6, 10), status="Liberado",
    )

    kpis = dashboard_periodo(date(2026, 6, 1), date(2026, 6, 30))

    assert kpis["faturamento"] == Decimal("200.00")
    assert kpis["lucro"] == Decimal("200.00")


def test_feed_mostra_o_avulso_com_a_corrida_somada():
    AtendimentoFactory(
        valor=Decimal("65.00"), transporte=True, transporte_valor=Decimal("20.00"),
        data=date(2026, 6, 10), status="Liberado",
    )

    feed = transacoes_recentes(date(2026, 6, 1), date(2026, 6, 30))

    assert feed[0]["valor"] == Decimal("85.00")


def test_feed_mostra_o_consumo_de_pacote_que_teve_corrida():
    """Um atendimento entra no feed se trouxe dinheiro, e pelo dinheiro que trouxe.

    Consumo de pacote com corrida trouxe o valor da corrida — e só ele.
    """
    pacote = PacoteContratadoFactory(
        valor_pago=Decimal("290.00"),
        data_compra=date(2026, 6, 1),
        competencia=date(2026, 6, 1),
    )
    AtendimentoFactory(
        pet=pacote.pet, pacote=pacote, valor=Decimal("65.00"),
        transporte=True, transporte_valor=Decimal("20.00"),
        data=date(2026, 6, 10), status="Liberado",
    )

    feed = transacoes_recentes(date(2026, 6, 1), date(2026, 6, 30))

    assert [(t["tipo"], t["valor"]) for t in feed] == [
        ("atendimento", Decimal("20.00")),
        ("pacote", Decimal("290.00")),
    ]


def test_feed_ignora_consumo_de_pacote_sem_corrida():
    """Sem corrida, o consumo não trouxe dinheiro nenhum: continua fora (invariante 1)."""
    pacote = PacoteContratadoFactory(
        valor_pago=Decimal("290.00"),
        data_compra=date(2026, 6, 1),
        competencia=date(2026, 6, 1),
    )
    AtendimentoFactory(
        pet=pacote.pet, pacote=pacote, valor=Decimal("65.00"),
        data=date(2026, 6, 10), status="Liberado",
    )

    feed = transacoes_recentes(date(2026, 6, 1), date(2026, 6, 30))

    assert [t["tipo"] for t in feed] == ["pacote"]


# --- Validação de pagamento -------------------------------------------------


def test_avulso_com_transporte_aceita_pagamento_do_total(api):
    """R$ 65 de banho + R$ 20 de corrida = um Pix de R$ 85. Antes isso dava 400."""
    pet, servico = PetFactory(), ServicoFactory()
    resp = api.post(
        "/api/atendimentos/",
        {
            "pet": pet.id, "servico": servico.id, "pacote": None,
            "data": "2026-06-10", "horario": "10:00", "valor": "65.00",
            "transporte": True, "transporte_valor": "20.00", "status": "Liberado",
            "pagamentos": [{"metodo": "Pix", "valor": "85.00"}],
        },
        format="json",
    )

    assert resp.status_code == 201, resp.data


def test_avulso_com_transporte_recusa_pagamento_so_do_servico(api):
    """O erro que a regra nova pega: cobrar o banho e esquecer a corrida."""
    pet, servico = PetFactory(), ServicoFactory()
    resp = api.post(
        "/api/atendimentos/",
        {
            "pet": pet.id, "servico": servico.id, "pacote": None,
            "data": "2026-06-10", "horario": "10:00", "valor": "65.00",
            "transporte": True, "transporte_valor": "20.00", "status": "Liberado",
            "pagamentos": [{"metodo": "Pix", "valor": "65.00"}],
        },
        format="json",
    )

    assert resp.status_code == 400


def test_consumo_de_pacote_com_transporte_cobra_so_a_corrida(api):
    """O banho já foi pago na venda; o pagamento aqui é o da corrida, e só."""
    pacote = PacoteContratadoFactory(
        valor_pago=Decimal("290.00"),
        data_compra=date(2026, 6, 1),
        competencia=date(2026, 6, 1),
    )
    servico = ServicoFactory()

    resp = api.post(
        "/api/atendimentos/",
        {
            "pet": pacote.pet.id, "servico": servico.id, "pacote": pacote.id,
            "data": "2026-06-10", "horario": "10:00", "valor": "65.00",
            "transporte": True, "transporte_valor": "20.00", "status": "Liberado",
            "pagamentos": [{"metodo": "Dinheiro", "valor": "20.00"}],
        },
        format="json",
    )

    assert resp.status_code == 201, resp.data


def test_consumo_de_pacote_recusa_pagamento_do_banho(api):
    """Faturar em dobro pela porta do pagamento: cobrar de novo o banho do pacote."""
    pacote = PacoteContratadoFactory(
        valor_pago=Decimal("290.00"),
        data_compra=date(2026, 6, 1),
        competencia=date(2026, 6, 1),
    )
    servico = ServicoFactory()

    resp = api.post(
        "/api/atendimentos/",
        {
            "pet": pacote.pet.id, "servico": servico.id, "pacote": pacote.id,
            "data": "2026-06-10", "horario": "10:00", "valor": "65.00",
            "transporte": True, "transporte_valor": "20.00", "status": "Liberado",
            "pagamentos": [{"metodo": "Dinheiro", "valor": "85.00"}],
        },
        format="json",
    )

    assert resp.status_code == 400


def test_consumo_de_pacote_sem_transporte_segue_sem_pagamento(api):
    """O caso comum do pacote: nada a cobrar, nenhuma linha de Pagamento."""
    pacote = PacoteContratadoFactory(
        valor_pago=Decimal("290.00"),
        data_compra=date(2026, 6, 1),
        competencia=date(2026, 6, 1),
    )
    servico = ServicoFactory()

    resp = api.post(
        "/api/atendimentos/",
        {
            "pet": pacote.pet.id, "servico": servico.id, "pacote": pacote.id,
            "data": "2026-06-10", "horario": "10:00", "valor": "65.00",
            "transporte": False, "transporte_valor": "0.00", "status": "Liberado",
            "pagamentos": [],
        },
        format="json",
    )

    assert resp.status_code == 201, resp.data


# --- O outro lado da corrida: o custo do triciclo --------------------------------
#
# A receita da corrida já entrava no faturamento; o custo dela entrava no bolo dos
# custos, sem nome. Separar os dois é o que responde "o triciclo se paga?".


def test_custo_transporte_soma_so_a_categoria_transporte():
    CustoFactory(descricao="Combustível", categoria="Transporte", valor=Decimal("180.00"),
                 competencia=date(2026, 6, 1))
    CustoFactory(descricao="Manutenção do triciclo", categoria="Transporte",
                 valor=Decimal("100.00"), competencia=date(2026, 6, 1))
    CustoFactory(descricao="Aluguel", categoria="Estrutura", valor=Decimal("2400.00"),
                 competencia=date(2026, 6, 1))

    assert custo_transporte_periodo(date(2026, 6, 1), date(2026, 6, 30)) == Decimal("280.00")


def test_custo_transporte_funde_variacoes_de_digitacao():
    """Mesma normalização de `custos_por_categoria`. Sem ela, "Transporte " digitado
    com espaço viraria uma despesa invisível para a tela do triciclo."""
    CustoFactory(categoria="Transporte", valor=Decimal("50.00"), competencia=date(2026, 6, 1))
    CustoFactory(categoria="transporte", valor=Decimal("30.00"), competencia=date(2026, 6, 1))
    CustoFactory(categoria="  TRANSPORTE  ", valor=Decimal("20.00"), competencia=date(2026, 6, 1))

    assert custo_transporte_periodo(date(2026, 6, 1), date(2026, 6, 30)) == Decimal("100.00")


def test_custo_transporte_respeita_a_competencia():
    """Invariante 10: editar o combustível de junho não pode mexer no de maio."""
    CustoFactory(categoria="Transporte", valor=Decimal("180.00"), competencia=date(2026, 5, 1))

    assert custo_transporte_periodo(date(2026, 6, 1), date(2026, 6, 30)) == Decimal("0")


def test_custo_transporte_sem_lancamento_e_zero_e_nao_none():
    """`Sum` de conjunto vazio devolve None; a tela faria "R$ NaN" com ele."""
    assert custo_transporte_periodo(date(2026, 6, 1), date(2026, 6, 30)) == Decimal("0")


def test_custo_transporte_nao_e_despesa_nova_dentro_de_custos():
    """O recorte é uma VISTA do total, não uma parcela extra.

    Se o dashboard passasse a somar `custo_transporte` a `custos`, o combustível
    seria descontado duas vezes do lucro. Este teste trava o total no lugar.
    """
    CustoFactory(categoria="Transporte", valor=Decimal("280.00"), competencia=date(2026, 6, 1))
    CustoFactory(categoria="Estrutura", valor=Decimal("2400.00"), competencia=date(2026, 6, 1))

    kpis = dashboard_periodo(date(2026, 6, 1), date(2026, 6, 30))

    assert kpis["custos"] == Decimal("2680.00")
    assert kpis["custo_transporte"] == Decimal("280.00")
    assert kpis["lucro"] == kpis["faturamento"] - Decimal("2680.00")


def test_dashboard_devolve_os_dois_lados_do_transporte(api):
    """O que a tela do Financeiro consome: receita e custo da corrida no mesmo payload."""
    AtendimentoFactory(
        valor=Decimal("65.00"), transporte=True, transporte_valor=Decimal("20.00"),
        data=date(2026, 6, 10), status="Liberado",
    )
    CustoFactory(categoria="Transporte", valor=Decimal("180.00"), competencia=date(2026, 6, 1))

    resp = api.get("/api/dashboard/?inicio=2026-06-01&fim=2026-06-30")

    assert resp.status_code == 200
    assert resp.data["transporte"] == "20.00"
    assert resp.data["custo_transporte"] == "180.00"
