import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from tests.factories import PetFactory, ServicoFactory, TutorFactory

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
