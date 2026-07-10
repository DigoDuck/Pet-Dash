import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from core.models import Atendimento, Pet, Tutor

pytestmark = pytest.mark.django_db


def test_seed_dev_popula_o_banco(settings):
    settings.DEBUG = True

    call_command("seed_dev")

    assert Tutor.objects.count() == 4
    assert Pet.objects.count() == 6
    assert Atendimento.objects.exists()
    assert Pet.objects.filter(atendimentos__isnull=True).exists()


def test_seed_dev_e_idempotente(settings):
    settings.DEBUG = True

    call_command("seed_dev")
    call_command("seed_dev")

    assert Tutor.objects.count() == 4
    assert Pet.objects.count() == 6
    # A segunda execução recria os atendimentos em vez de duplicá-los.
    assert Atendimento.objects.count() == 6


def test_seed_dev_recusa_rodar_sem_debug(settings):
    settings.DEBUG = False

    with pytest.raises(CommandError, match="DEBUG"):
        call_command("seed_dev")

    assert Tutor.objects.count() == 0
