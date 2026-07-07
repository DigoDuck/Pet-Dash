import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from core.models import Atendimento
from tests.factories import PetFactory, ServicoFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    user = User.objects.create_user(username="p", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_cria_atendimento_avulso_com_pagamentos_aninhados(api):
    pet, servico = PetFactory(), ServicoFactory()
    payload = {
        "pet": pet.id, "servico": servico.id,
        "data": "2026-06-10", "horario": "14:30", "valor": "120.00",
        "status": "Liberado",
        "pagamentos": [
            {"metodo": "Pix", "valor": "80.00"},
            {"metodo": "Dinheiro", "valor": "40.00"},
        ],
    }
    resp = api.post("/api/atendimentos/", payload, format="json")
    assert resp.status_code == 201, resp.content
    atendimento = Atendimento.objects.get(id=resp.json()["id"])
    assert atendimento.pagamentos.count() == 2
