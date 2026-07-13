import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from tests.factories import CustoFactory, RetiradaFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    user = User.objects.create_user(username="patricia", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_cria_custo_por_competencia(api):
    resp = api.post("/api/custos/", {
        "tipo": "fixo", "descricao": "Aluguel", "valor": "2400.00",
        "competencia": "2026-06-01",
    })
    assert resp.status_code == 201


def test_filtra_custo_por_tipo(api):
    CustoFactory(tipo="fixo")
    CustoFactory(tipo="variavel")
    assert api.get("/api/custos/?tipo=fixo").json()["count"] == 1


def test_filtra_custo_por_competencia(api):
    from datetime import date

    CustoFactory(competencia=date(2026, 5, 1))
    CustoFactory(competencia=date(2026, 6, 1))
    assert api.get("/api/custos/?competencia=2026-06-01").json()["count"] == 1


def test_cria_retirada(api):
    resp = api.post("/api/retiradas/", {
        "descricao": "Pró-labore", "valor": "500.00", "data": "2026-06-15",
    })
    assert resp.status_code == 201


def test_filtra_retirada_por_data(api):
    from datetime import date

    RetiradaFactory(data=date(2026, 6, 15))
    RetiradaFactory(data=date(2026, 6, 20))
    assert api.get("/api/retiradas/?data=2026-06-15").json()["count"] == 1


def test_filtra_retirada_por_intervalo(api):
    from datetime import date

    RetiradaFactory(data=date(2026, 6, 1))
    RetiradaFactory(data=date(2026, 6, 30))
    RetiradaFactory(data=date(2026, 7, 1))  # fora do intervalo, prova o recorte

    resp = api.get("/api/retiradas/?data__gte=2026-06-01&data__lte=2026-06-30")

    assert resp.status_code == 200
    assert resp.json()["count"] == 2


def test_lista_custos_do_mesmo_mes_em_ordem_estavel(api):
    """Sem desempate, a ordem das linhas do mesmo mês é indefinida no Postgres e a
    paginação pode repetir ou pular lançamentos. Descrições sem acento de
    propósito: a posição de "Á" depende do collation do banco."""
    from datetime import date

    junho = date(2026, 6, 1)
    CustoFactory(competencia=junho, descricao="Luz")
    CustoFactory(competencia=junho, descricao="Aluguel")
    CustoFactory(competencia=junho, descricao="Internet")

    resp = api.get("/api/custos/?competencia=2026-06-01")

    assert [c["descricao"] for c in resp.json()["results"]] == ["Aluguel", "Internet", "Luz"]
