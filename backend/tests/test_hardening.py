"""Guardas encontradas na revisão pré-deploy.

Todas fecham caminhos que o formulário nunca exercita, mas a API, o admin ou um
parâmetro malformado sim. Nenhuma delas era pega por teste.
"""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth.models import User
from django.core.cache import cache
from rest_framework.test import APIClient

from core.models import Custo
from core.services import dashboard_periodo, serie_mensal
from tests.factories import (
    AtendimentoFactory,
    CustoFactory,
    PacoteContratadoFactory,
    PetFactory,
    ServicoFactory,
)

pytestmark = pytest.mark.django_db


def test_competencia_do_custo_e_normalizada_para_o_dia_1():
    """Um custo com dia 15 entrava no KPI (que usa __range) e sumia do gráfico e da
    lista (que casam o dia 1 exato) — dois números da mesma tela discordando."""
    custo = Custo.objects.create(
        tipo="fixo", descricao="Aluguel", valor=Decimal("800.00"),
        competencia=date(2026, 6, 15),
    )

    custo.refresh_from_db()
    assert custo.competencia == date(2026, 6, 1)

    # E agora o KPI e a série concordam sobre ele.
    assert dashboard_periodo(date(2026, 6, 1), date(2026, 6, 30))["custos"] == Decimal("800.00")
    assert serie_mensal(date(2026, 6, 1), date(2026, 6, 30))[0]["custos"] == Decimal("800.00")


def test_transporte_desmarcado_zera_o_valor_da_corrida(api):
    """O faturamento soma `transporte_valor` sem olhar o booleano. Sem esta guarda, uma
    escrita pela API com `transporte=False, transporte_valor=20` faturava uma viagem
    que nunca houve."""
    pet, servico = PetFactory(), ServicoFactory()

    resp = api.post(
        "/api/atendimentos/",
        {
            "pet": pet.id, "servico": servico.id, "pacote": None,
            "data": "2026-06-10", "horario": "10:00", "valor": "65.00",
            "transporte": False, "transporte_valor": "20.00", "status": "Liberado",
            "pagamentos": [{"metodo": "Pix", "valor": "65.00"}],
        },
        format="json",
    )

    assert resp.status_code == 201, resp.data
    assert resp.data["transporte_valor"] == "0.00"
    assert dashboard_periodo(date(2026, 6, 1), date(2026, 6, 30))["faturamento"] == Decimal("65.00")


def test_pacote_de_outro_pet_e_recusado(api):
    """A API aceitava consumir o crédito do pacote de outro pet — e o saldo de quem
    pagou sumia sem explicação."""
    pacote = PacoteContratadoFactory(
        valor_pago=Decimal("290.00"),
        data_compra=date(2026, 6, 1),
        competencia=date(2026, 6, 1),
    )
    outro_pet = PetFactory()
    servico = ServicoFactory()

    resp = api.post(
        "/api/atendimentos/",
        {
            "pet": outro_pet.id, "servico": servico.id, "pacote": pacote.id,
            "data": "2026-06-10", "horario": "10:00", "valor": "65.00",
            "transporte": False, "transporte_valor": "0.00", "status": "Liberado",
            "pagamentos": [],
        },
        format="json",
    )

    assert resp.status_code == 400
    assert "outro pet" in str(resp.data)


def test_pacote_ativo_com_competencia_invalida_devolve_400(api):
    """O formulário passou a mandar `?competencia=` em toda busca de pacote: o caminho
    do parâmetro malformado deixou de ser hipotético, e antes estourava 500."""
    pet = PetFactory()

    resp = api.get(f"/api/pets/{pet.id}/pacote-ativo/?competencia=banana")

    assert resp.status_code == 400


def test_pacote_ativo_respeita_a_competencia_pedida(api):
    """Lançar em julho o banho de junho tem que achar o pacote de JUNHO."""
    pacote = PacoteContratadoFactory(
        valor_pago=Decimal("290.00"),
        data_compra=date(2026, 6, 1),
        competencia=date(2026, 6, 1),
    )

    achou = api.get(f"/api/pets/{pacote.pet_id}/pacote-ativo/?competencia=2026-06-01")
    assert achou.status_code == 200
    assert achou.data["id"] == pacote.id

    # Julho não tem pacote: 204, e o atendimento nasce avulso — corretamente.
    vazio = api.get(f"/api/pets/{pacote.pet_id}/pacote-ativo/?competencia=2026-07-01")
    assert vazio.status_code == 204


def test_serie_recusa_intervalo_longo_demais(api):
    """3 queries por mês, sem teto: um `?inicio=0202-01-01` (ISO válido) geraria dezenas
    de milhares de meses e travaria o worker até o timeout."""
    resp = api.get("/api/dashboard/serie/?inicio=0202-01-01&fim=2026-12-31")

    assert resp.status_code == 400
    assert "meses" in str(resp.data)


def test_serie_aceita_a_janela_do_grafico(api):
    """Guarda do guarda: o teto não pode barrar o uso real (6 meses)."""
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 6, 10), status="Liberado")

    resp = api.get("/api/dashboard/serie/?inicio=2026-02-01&fim=2026-07-31")

    assert resp.status_code == 200
    assert len(resp.data) == 6


def test_login_tem_limite_de_tentativas():
    """Único ponto de entrada, exposto na internet, com o nome de usuário num repo
    público. Sem throttle, um scanner tenta senha sem limite.

    O `cache.clear()` não é decoração: o throttle do DRF conta no cache, que é global ao
    processo. Sem limpar, este teste herda as tentativas de quem rodou antes (e deixa as
    dele para quem vier depois) — a suíte passa ou falha conforme a ordem dos testes.
    """
    cache.clear()
    User.objects.create_user(username="patricia", password="senha-forte-123")
    client = APIClient()

    codigos = [
        client.post(
            "/api/token/", {"username": "patricia", "password": "errada"}, format="json"
        ).status_code
        for _ in range(25)
    ]

    assert 429 in codigos, "o login aceitou 25 tentativas seguidas sem throttle"

    # Não deixa a contagem estourada para o próximo teste que fizer uma request anônima.
    cache.clear()


def test_custo_lancado_pela_api_no_dia_15_aparece_na_lista_do_mes(api):
    """O fecho do ciclo: normalizado, ele é encontrado pelo filtro da tela."""
    CustoFactory(competencia=date(2026, 6, 20), valor=Decimal("100.00"))

    resp = api.get("/api/custos/?competencia=2026-06-01")

    assert resp.data["count"] == 1
