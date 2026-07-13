from datetime import date

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    user = User.objects.create_user(username="p", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_vende_pacote_e_expoe_saldo(api):
    from tests.factories import PetFactory, ServicoFactory
    pet = PetFactory()
    servico = ServicoFactory(is_pacote=True, creditos=4)
    payload = {
        "pet": pet.id, "servico": servico.id, "competencia": "2026-06-15",
        "qtd_total": 4, "valor_pago": "220.00", "data_compra": "2026-06-01",
        "validade": "2026-06-30",
    }
    resp = api.post("/api/pacotes/", payload, format="json")
    assert resp.status_code == 201
    assert resp.json()["saldo"] == 4
    assert resp.json()["competencia"] == "2026-06-01"  # normalizado


def test_pacote_duplicado_no_mes_da_400(api):
    from tests.factories import PacoteContratadoFactory
    pacote = PacoteContratadoFactory(competencia=date(2026, 6, 1))
    payload = {
        "pet": pacote.pet.id, "servico": pacote.servico.id, "competencia": "2026-06-20",
        "qtd_total": 4, "valor_pago": "220.00", "data_compra": "2026-06-02",
        "validade": "2026-06-30",
    }
    resp = api.post("/api/pacotes/", payload, format="json")
    assert resp.status_code == 400


def test_endpoint_pacote_ativo_do_pet(api):
    from tests.factories import PacoteContratadoFactory
    pacote = PacoteContratadoFactory(competencia=date(2026, 6, 1))
    resp = api.get(f"/api/pets/{pacote.pet.id}/pacote-ativo/?competencia=2026-06-01")
    assert resp.status_code == 200
    assert resp.json()["id"] == pacote.id
    assert resp.json()["saldo"] == 4


def test_lista_filtra_por_competencia_e_traz_nomes(api):
    from tests.factories import PacoteContratadoFactory

    pacote = PacoteContratadoFactory(competencia=date(2026, 6, 1))
    PacoteContratadoFactory(competencia=date(2026, 7, 1))

    resp = api.get("/api/pacotes/?competencia=2026-06-01")

    assert resp.status_code == 200
    dados = resp.json()
    assert dados["count"] == 1
    item = dados["results"][0]
    assert item["id"] == pacote.id
    assert item["pet_nome"] == pacote.pet.nome
    assert item["tutor_nome"] == pacote.pet.tutor.nome
    assert item["servico_nome"] == pacote.servico.nome
    assert item["saldo"] == 4


def test_busca_pacote_pelo_nome_do_pet(api):
    from tests.factories import PacoteContratadoFactory, PetFactory

    alvo = PacoteContratadoFactory(pet=PetFactory(nome="Rex"), competencia=date(2026, 6, 1))
    PacoteContratadoFactory(pet=PetFactory(nome="Luna"), competencia=date(2026, 6, 1))

    resp = api.get("/api/pacotes/?search=Rex")

    assert resp.status_code == 200
    assert [p["id"] for p in resp.json()["results"]] == [alvo.id]