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
