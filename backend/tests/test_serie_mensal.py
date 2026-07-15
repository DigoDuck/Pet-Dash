from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from core.services import dashboard_periodo, serie_mensal
from tests.factories import (
    AtendimentoFactory,
    CustoFactory,
    PacoteContratadoFactory,
    PetFactory,
    RetiradaFactory,
)

pytestmark = pytest.mark.django_db


def test_serie_uma_linha_por_mes_do_intervalo():
    serie = serie_mensal(date(2026, 4, 1), date(2026, 6, 30))

    assert [ponto["competencia"] for ponto in serie] == [
        date(2026, 4, 1),
        date(2026, 5, 1),
        date(2026, 6, 1),
    ]


def test_serie_atravessa_a_virada_de_ano():
    serie = serie_mensal(date(2025, 11, 1), date(2026, 2, 28))

    assert [ponto["competencia"] for ponto in serie] == [
        date(2025, 11, 1),
        date(2025, 12, 1),
        date(2026, 1, 1),
        date(2026, 2, 1),
    ]


def test_serie_mantem_mes_sem_movimento_como_linha_de_zeros():
    """Mês vazio é uma linha de zeros, não uma linha ausente.

    Se maio sumisse, o gráfico colaria abril em junho e a leitura de tendência mentiria.
    """
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 4, 10), status="Liberado")
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 6, 10), status="Liberado")

    serie = serie_mensal(date(2026, 4, 1), date(2026, 6, 30))

    assert len(serie) == 3
    assert serie[1]["competencia"] == date(2026, 5, 1)
    assert serie[1]["faturamento"] == Decimal("0")
    assert serie[1]["custos"] == Decimal("0")
    assert serie[1]["lucro"] == Decimal("0")


def test_serie_soma_faturamento_custos_e_lucro_do_mes():
    PacoteContratadoFactory(
        valor_pago=Decimal("220.00"),
        data_compra=date(2026, 6, 5),
        competencia=date(2026, 6, 1),
    )
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 6, 10), status="Liberado")
    CustoFactory(valor=Decimal("100.00"), competencia=date(2026, 6, 1))

    ponto = serie_mensal(date(2026, 6, 1), date(2026, 6, 30))[0]

    assert ponto["faturamento"] == Decimal("315.00")
    assert ponto["custos"] == Decimal("100.00")
    assert ponto["lucro"] == Decimal("215.00")


def test_serie_bate_com_dashboard_periodo_no_mesmo_mes():
    """Guarda da decisão de reusar faturamento_periodo em vez de um GROUP BY novo.

    Se um dia a série virar TruncMonth e a regra da invariante 1 for reescrita, é
    este teste que pega a divergência entre a barra e o KPI da mesma tela.
    """
    PacoteContratadoFactory(
        valor_pago=Decimal("220.00"),
        data_compra=date(2026, 6, 5),
        competencia=date(2026, 6, 1),
    )
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 6, 10), status="Liberado")
    AtendimentoFactory(valor=Decimal("80.00"), data=date(2026, 6, 20), status="Pendente")
    CustoFactory(valor=Decimal("100.00"), competencia=date(2026, 6, 1))

    ponto = serie_mensal(date(2026, 6, 1), date(2026, 6, 30))[0]
    kpis = dashboard_periodo(date(2026, 6, 1), date(2026, 6, 30))

    assert ponto["faturamento"] == kpis["faturamento"]
    assert ponto["custos"] == kpis["custos"]
    assert ponto["lucro"] == kpis["lucro"]


def test_serie_nao_conta_consumo_de_pacote_no_faturamento():
    """Invariante 1: atendimento com pacote_id já foi pago na venda."""
    pacote = PacoteContratadoFactory(
        valor_pago=Decimal("220.00"),
        data_compra=date(2026, 6, 1),
        competencia=date(2026, 6, 1),
    )
    AtendimentoFactory(
        pet=pacote.pet, pacote=pacote, valor=Decimal("95.00"),
        data=date(2026, 6, 10), status="Liberado",
    )

    ponto = serie_mensal(date(2026, 6, 1), date(2026, 6, 30))[0]

    assert ponto["faturamento"] == Decimal("220.00")


def test_serie_conta_venda_de_pacote_pela_data_da_compra():
    """Pacote comprado em maio com competência de junho fatura em maio (regime de caixa)."""
    PacoteContratadoFactory(
        valor_pago=Decimal("220.00"),
        data_compra=date(2026, 5, 28),
        competencia=date(2026, 6, 1),
    )

    serie = serie_mensal(date(2026, 5, 1), date(2026, 6, 30))

    assert serie[0]["faturamento"] == Decimal("220.00")
    assert serie[1]["faturamento"] == Decimal("0")


def test_serie_ignora_atendimento_cancelado_e_pendente():
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 6, 10), status="Cancelado")
    AtendimentoFactory(valor=Decimal("80.00"), data=date(2026, 6, 11), status="Pendente")

    ponto = serie_mensal(date(2026, 6, 1), date(2026, 6, 30))[0]

    assert ponto["faturamento"] == Decimal("0")


def test_serie_nao_desconta_retirada_do_lucro():
    """Retirada é distribuição de lucro, não despesa."""
    AtendimentoFactory(valor=Decimal("300.00"), data=date(2026, 6, 10), status="Liberado")
    RetiradaFactory(valor=Decimal("200.00"), data=date(2026, 6, 15))

    ponto = serie_mensal(date(2026, 6, 1), date(2026, 6, 30))[0]

    assert ponto["lucro"] == Decimal("300.00")


def test_serie_endpoint_retorna_pontos(api):
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 6, 10), status="Liberado")
    CustoFactory(valor=Decimal("40.00"), competencia=date(2026, 6, 1))

    resp = api.get("/api/dashboard/serie/?inicio=2026-05-01&fim=2026-06-30")

    assert resp.status_code == 200
    assert resp.json() == [
        {"competencia": "2026-05-01", "faturamento": "0.00", "custos": "0.00", "lucro": "0.00"},
        {"competencia": "2026-06-01", "faturamento": "95.00", "custos": "40.00", "lucro": "55.00"},
    ]


def test_serie_endpoint_sem_params_retorna_400(api):
    assert api.get("/api/dashboard/serie/").status_code == 400


def test_serie_endpoint_data_invalida_retorna_400(api):
    assert api.get("/api/dashboard/serie/?inicio=banana&fim=2026-06-30").status_code == 400


def test_serie_endpoint_exige_auth():
    resp = APIClient().get("/api/dashboard/serie/?inicio=2026-05-01&fim=2026-06-30")
    assert resp.status_code == 401


def test_serie_endpoint_nao_vaza_pet_inativo_no_faturamento(api):
    """Soft-delete some da vitrine (VIP), mas o dinheiro do histórico continua contando."""
    pet = PetFactory(ativo=False)
    AtendimentoFactory(
        pet=pet, valor=Decimal("95.00"), data=date(2026, 6, 10), status="Liberado",
    )

    body = api.get("/api/dashboard/serie/?inicio=2026-06-01&fim=2026-06-30").json()

    assert body[0]["faturamento"] == "95.00"
