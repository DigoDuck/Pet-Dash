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


def test_filtra_atendimentos_por_status(api):
    from tests.factories import AtendimentoFactory

    AtendimentoFactory(status="Liberado")
    AtendimentoFactory(status="Pendente")
    resp = api.get("/api/atendimentos/?status=Liberado")
    assert resp.json()["count"] == 1

def test_avulso_com_pagamentos_que_nao_somam_e_rejeitado(api):
    pet, servico = PetFactory(), ServicoFactory()
    payload  = {
        "pet": pet.id,  "servico": servico.id, "data": "2026-06-10",
        "horario": "14:30",  "valor": "120.00", "status": "Liberado",
        "pagamentos": [{"metodo": "Pix", "valor": " 80.00"}], # Falta 40
    }
    resp = api.post("/api/atendimentos/", payload, format="json")
    assert resp.status_code == 400
    
    
def test_consumo_de_pacote_nao_exige_soma_de_pagamentos(api):
    from tests.factories import PacoteContratadoFactory
    pacote = PacoteContratadoFactory()
    payload = {
        "pet": pacote.pet.id, "servico": pacote.servico.id, "pacote": pacote.id,
        "data": "2026-06-12", "horario": "10:00", "valor": "65.00", "status": "Liberado",
    }
    resp = api.post("/api/atendimentos/", payload, format="json")
    assert resp.status_code == 201
    
def test_nao_marca_atendimento_em_pacote_sem_saldo(api):
    from tests.factories import AtendimentoFactory, PacoteContratadoFactory
    pacote = PacoteContratadoFactory(qtd_total=1)
    AtendimentoFactory(pacote=pacote, pet=pacote.pet, status="Liberado") # esgota
    payload = {
        "pet": pacote.pet.id, "servico": pacote.servico.id, "pacote": pacote.id,
        "data": "2026-06-20", "horario": "11:00", "valor": "65.00", "status": "Pendente",
    }
    resp = api.post("/api/atendimentos/", payload, format="json")
    assert resp.status_code == 400
    
def test_cancelar_atendimento_em_pacote_sem_saldo_e_permitido(api):
    from tests.factories import AtendimentoFactory, PacoteContratadoFactory
    pacote = PacoteContratadoFactory(qtd_total=1)
    AtendimentoFactory(pacote=pacote, pet=pacote.pet, status="Liberado")  # esgota
    payload = {
        "pet": pacote.pet.id, "servico": pacote.servico.id, "pacote": pacote.id,
        "data": "2026-06-20", "horario": "11:00", "valor": "65.00", "status": "Cancelado",
    }
    resp = api.post("/api/atendimentos/", payload, format="json")
    assert resp.status_code == 201


def test_editar_atendimento_que_ocupa_ultimo_credito_e_permitido(api):
    # Update não pode contar o próprio atendimento contra ele mesmo no guard de saldo.
    from tests.factories import AtendimentoFactory, PacoteContratadoFactory

    pacote = PacoteContratadoFactory(qtd_total=1)
    atendimento = AtendimentoFactory(pacote=pacote, pet=pacote.pet, status="Liberado")
    payload = {
        "pet": pacote.pet.id, "servico": atendimento.servico.id, "pacote": pacote.id,
        "data": "2026-06-21", "horario": "12:00", "valor": "65.00", "status": "Liberado",
    }
    resp = api.put(f"/api/atendimentos/{atendimento.id}/", payload, format="json")
    assert resp.status_code == 200, resp.content