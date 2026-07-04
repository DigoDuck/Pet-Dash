import pytest

pytestmark = pytest.mark.django_db


def test_admin_esta_acessivel(client):
    assert client.get("/admin/login/").status_code == 200
