from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from tests.factories import AtendimentoFactory, PetFactory, ServicoFactory, TutorFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    user = User.objects.create_user(username="patricia", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_lista_tutores_exige_auth():
    resp = APIClient().get("/api/tutores/")
    assert resp.status_code == 401


def test_cria_e_lista_tutor(api):
    resp = api.post("/api/tutores/", {"nome": "Ana", "telefone": "71999990000"})
    assert resp.status_code == 201
    assert resp.json()["ativo"] is True

    lista = api.get("/api/tutores/").json()
    assert lista["count"] == 1


def test_busca_tutor_por_nome(api):
    TutorFactory(nome="Mariana")
    TutorFactory(nome="Roberto")
    resp = api.get("/api/tutores/?search=Mari")
    assert resp.json()["count"] == 1


def test_destroy_tutor_e_soft_delete(api):
    tutor = TutorFactory()
    resp = api.delete(f"/api/tutores/{tutor.id}/")
    assert resp.status_code == 204
    tutor.refresh_from_db()
    assert tutor.ativo is False
    assert api.get("/api/tutores/").json()["count"] == 0


def test_cria_pet_vinculado_ao_tutor(api):
    tutor = TutorFactory()
    resp = api.post("/api/pets/", {"tutor": tutor.id, "nome": "Rex", "raca": "SRD"})
    assert resp.status_code == 201
    assert resp.json()["tutor_nome"] == tutor.nome


def test_filtra_pets_por_tutor(api):
    t1 = TutorFactory()
    PetFactory(tutor=t1)
    PetFactory()  # outro tutor
    resp = api.get(f"/api/pets/?tutor={t1.id}")
    assert resp.json()["count"] == 1


def test_cria_e_filtra_servico_pacote(api):
    ServicoFactory(nome="Banho", is_pacote=False)
    ServicoFactory(nome="Pacote Fidelidade", is_pacote=True, creditos=4)
    resp = api.get("/api/servicos/?is_pacote=true")
    assert resp.json()["count"] == 1
    assert resp.json()["results"][0]["nome"] == "Pacote Fidelidade"


def _atendimento(pet, dias_atras, valor="50.00", status="Liberado"):
    return AtendimentoFactory(
        pet=pet,
        status=status,
        valor=Decimal(valor),
        data=date.today() - timedelta(days=dias_atras),
    )


def test_pet_vip_por_tres_visitas(api):
    pet = PetFactory()
    for dias in (1, 10, 20):
        _atendimento(pet, dias)

    dados = api.get(f"/api/pets/{pet.id}/").json()

    assert dados["vip"] is True
    assert dados["qtd_visitas"] == 3
    assert dados["total_gasto"] == "150.00"


def test_pet_vip_por_gasto(api):
    pet = PetFactory()
    _atendimento(pet, 5, valor="600.00")

    dados = api.get(f"/api/pets/{pet.id}/").json()

    assert dados["vip"] is True
    assert dados["qtd_visitas"] == 1


def test_pet_comum_nao_e_vip(api):
    pet = PetFactory()
    _atendimento(pet, 5, valor="100.00")

    assert api.get(f"/api/pets/{pet.id}/").json()["vip"] is False


def test_pet_sem_atendimento_aparece_na_lista(api):
    """Trava o INNER JOIN: sem agregação condicional, este pet sumiria."""
    PetFactory()

    lista = api.get("/api/pets/").json()

    assert lista["count"] == 1
    assert lista["results"][0]["vip"] is False
    assert lista["results"][0]["qtd_visitas"] == 0
    assert lista["results"][0]["total_gasto"] == "0.00"


def test_atendimento_antigo_nao_faz_vip(api):
    pet = PetFactory()
    _atendimento(pet, dias_atras=400, valor="900.00")

    assert api.get(f"/api/pets/{pet.id}/").json()["vip"] is False


def test_status_pendente_nao_faz_vip(api):
    pet = PetFactory()
    for dias in (1, 2, 3):
        _atendimento(pet, dias, status="Pendente")

    assert api.get(f"/api/pets/{pet.id}/").json()["vip"] is False


def test_post_de_pet_responde_vip_falso_sem_estourar(api):
    """O objeto do create não passa pelo get_queryset() anotado."""
    tutor = TutorFactory()

    resp = api.post("/api/pets/", {"tutor": tutor.id, "nome": "Rex", "porte": "M"})

    assert resp.status_code == 201
    assert resp.json()["vip"] is False
    assert resp.json()["qtd_visitas"] == 0
    assert resp.json()["total_gasto"] == "0.00"
