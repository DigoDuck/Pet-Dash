import pytest
from django.contrib.auth.models import User

pytestmark = pytest.mark.django_db


def test_healthcheck_e_publico(client):
    resp = client.get("/api/health/")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_endpoint_protegido_sem_token_da_401(client):
    # /api/tutores/ é criado no PR 5; aqui aceitamos 401 (quando existir) ou 404 (antes).
    resp = client.get("/api/tutores/")
    assert resp.status_code in (401, 404)


def test_obtem_token_com_credenciais(client):
    User.objects.create_user(username="patricia", password="senha-forte-123")
    resp = client.post(
        "/api/token/", {"username": "patricia", "password": "senha-forte-123"}
    )
    assert resp.status_code == 200
    assert "access" in resp.json() and "refresh" in resp.json()
