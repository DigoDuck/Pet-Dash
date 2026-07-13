from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from core.services import dashboard_periodo, transacoes_recentes
from tests.factories import (
    AtendimentoFactory,
    CustoFactory,
    PacoteContratadoFactory,
    PetFactory,
    RetiradaFactory,
    ServicoFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    user = User.objects.create_user(username="p", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_consumo_de_pacote_nao_entra_no_feed():
    """Invariante 1, na forma visual.

    O 2º banho do pacote é um atendimento normal, mas o dinheiro dele entrou na
    venda. Se ele aparecesse no feed como "+R$ 95,00", a tela criaria receita que
    não existe — o mesmo erro de faturar em dobro, agora pela porta do design.
    """
    pacote = PacoteContratadoFactory(
        valor_pago=Decimal("220.00"),
        data_compra=date(2026, 6, 1),
        competencia=date(2026, 6, 1),
    )
    AtendimentoFactory(
        pet=pacote.pet, pacote=pacote, valor=Decimal("95.00"),
        data=date(2026, 6, 10), status="Liberado",
    )
    AtendimentoFactory(valor=Decimal("80.00"), data=date(2026, 6, 12), status="Liberado")

    feed = transacoes_recentes(date(2026, 6, 1), date(2026, 6, 30))

    assert [(t["tipo"], t["valor"]) for t in feed] == [
        ("atendimento", Decimal("80.00")),
        ("pacote", Decimal("220.00")),
    ]


def test_feed_une_as_quatro_fontes_por_data_desc():
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 6, 2), status="Liberado")
    PacoteContratadoFactory(
        valor_pago=Decimal("220.00"),
        data_compra=date(2026, 6, 20),
        competencia=date(2026, 6, 1),
    )
    CustoFactory(valor=Decimal("300.00"), competencia=date(2026, 6, 1))
    RetiradaFactory(valor=Decimal("500.00"), data=date(2026, 6, 15))

    feed = transacoes_recentes(date(2026, 6, 1), date(2026, 6, 30))

    assert [t["tipo"] for t in feed] == ["pacote", "retirada", "atendimento", "custo"]


def test_venda_de_pacote_entra_pela_data_da_compra_nao_pela_competencia():
    """Regime de caixa: o pacote de junho comprado em maio é dinheiro de maio."""
    PacoteContratadoFactory(
        valor_pago=Decimal("220.00"),
        data_compra=date(2026, 5, 28),
        competencia=date(2026, 6, 1),
    )

    assert transacoes_recentes(date(2026, 6, 1), date(2026, 6, 30)) == []
    assert len(transacoes_recentes(date(2026, 5, 1), date(2026, 5, 31))) == 1


def test_pendente_e_cancelado_ficam_fora():
    """Só Liberado entrou dinheiro; Pendente ocupa crédito, Cancelado devolve."""
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 6, 10), status="Pendente")
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 6, 11), status="Cancelado")

    assert transacoes_recentes(date(2026, 6, 1), date(2026, 6, 30)) == []


def test_feed_respeita_o_limite_pegando_os_mais_recentes():
    for dia in range(1, 11):
        AtendimentoFactory(
            valor=Decimal("50.00"), data=date(2026, 6, dia), status="Liberado",
        )

    feed = transacoes_recentes(date(2026, 6, 1), date(2026, 6, 30), limite=8)

    assert len(feed) == 8
    assert feed[0]["data"] == date(2026, 6, 10)
    assert feed[-1]["data"] == date(2026, 6, 3)


def test_descricao_do_atendimento_traz_servico_e_pet():
    servico = ServicoFactory(nome="Banho e tosa")
    pet = PetFactory(nome="Luna")
    AtendimentoFactory(
        servico=servico, pet=pet, valor=Decimal("95.00"),
        data=date(2026, 6, 10), status="Liberado",
    )

    feed = transacoes_recentes(date(2026, 6, 1), date(2026, 6, 30))

    assert feed[0]["descricao"] == "Banho e tosa · Luna"


def test_qtd_atendimentos_conta_visitas_e_difere_do_denominador_do_ticket():
    """Dois números que parecem o mesmo e não são.

    `qtd_atendimentos` conta VISITAS (o 2º e 3º banho do pacote contam: invariante 2,
    eles entram em frequência e histórico). O ticket médio divide por EVENTOS DE
    RECEITA (1 venda de pacote + 1 avulso = 2). Unificar os dois corromperia o
    ticket: 315 / 4 em vez de 315 / 2.
    """
    pacote = PacoteContratadoFactory(
        valor_pago=Decimal("220.00"),
        data_compra=date(2026, 6, 1),
        competencia=date(2026, 6, 1),
    )
    for dia in (10, 17):
        AtendimentoFactory(
            pet=pacote.pet, pacote=pacote, valor=Decimal("95.00"),
            data=date(2026, 6, dia), status="Liberado",
        )
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 6, 20), status="Liberado")

    kpis = dashboard_periodo(date(2026, 6, 1), date(2026, 6, 30))

    assert kpis["qtd_atendimentos"] == 3  # 2 consumos + 1 avulso
    assert kpis["faturamento"] == Decimal("315.00")  # 220 pacote + 95 avulso
    assert kpis["ticket_medio"] == Decimal("157.50")  # 315 / 2 eventos, não / 3 visitas


def test_pets_ativos_ignora_soft_delete():
    PetFactory()
    PetFactory()
    PetFactory(ativo=False)

    kpis = dashboard_periodo(date(2026, 6, 1), date(2026, 6, 30))

    assert kpis["pets_ativos"] == 2


def test_endpoint_de_transacoes(api):
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 6, 10), status="Liberado")
    CustoFactory(descricao="Aluguel", valor=Decimal("300.00"), competencia=date(2026, 6, 1))

    resp = api.get("/api/dashboard/transacoes/?inicio=2026-06-01&fim=2026-06-30")

    assert resp.status_code == 200
    body = resp.json()
    assert [t["tipo"] for t in body] == ["atendimento", "custo"]
    assert body[1] == {
        "tipo": "custo",
        "descricao": "Aluguel",
        "valor": "300.00",
        "data": "2026-06-01",
    }


def test_endpoint_de_transacoes_sem_params_retorna_400(api):
    assert api.get("/api/dashboard/transacoes/").status_code == 400


def test_endpoint_de_transacoes_exige_auth():
    resp = APIClient().get("/api/dashboard/transacoes/?inicio=2026-06-01&fim=2026-06-30")
    assert resp.status_code == 401


def test_dashboard_endpoint_expoe_os_dois_contadores(api):
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 6, 10), status="Liberado")

    body = api.get("/api/dashboard/?inicio=2026-06-01&fim=2026-06-30").json()

    assert body["qtd_atendimentos"] == 1
    assert body["pets_ativos"] == 1
