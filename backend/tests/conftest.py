import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient


@pytest.fixture
def api():
    """Cliente autenticado. Single-user (Patricia), sem RBAC — um usuário basta.

    Vivia copiada em dez arquivos de teste; mudar o setup de auth exigia dez edições.
    """
    user = User.objects.create_user(username="patricia", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client
