from datetime import date, timedelta
from decimal import Decimal

import pytest

from core.models import Pet
from core.services import anota_vip
from tests.factories import AtendimentoFactory, PetFactory

pytestmark = pytest.mark.django_db

HOJE = date(2026, 7, 10)


def atendimento(pet, dias_atras, valor="50.00", status="Liberado"):
    return AtendimentoFactory(
        pet=pet,
        status=status,
        valor=Decimal(valor),
        data=HOJE - timedelta(days=dias_atras),
    )


def anotado(pet):
    return anota_vip(Pet.objects.filter(pk=pet.pk), HOJE).get()


def test_pet_sem_atendimento_aparece_com_zeros():
    PetFactory()  # sem atribuição: F841 se a variável não for usada

    resultado = anota_vip(Pet.objects.all(), HOJE)

    assert resultado.count() == 1
    assert resultado.get().qtd_visitas == 0
    assert resultado.get().total_gasto == Decimal("0")


def test_conta_visitas_liberadas_na_janela():
    pet = PetFactory()
    for dias in (1, 30, 200):
        atendimento(pet, dias)

    assert anotado(pet).qtd_visitas == 3
    assert anotado(pet).total_gasto == Decimal("150.00")


def test_ignora_atendimento_fora_da_janela_de_365_dias():
    pet = PetFactory()
    atendimento(pet, dias_atras=400, valor="900.00")

    assert anotado(pet).qtd_visitas == 0
    assert anotado(pet).total_gasto == Decimal("0")


def test_ignora_status_pendente_e_cancelado():
    pet = PetFactory()
    atendimento(pet, 5, status="Pendente")
    atendimento(pet, 6, status="Cancelado")

    assert anotado(pet).qtd_visitas == 0
    assert anotado(pet).total_gasto == Decimal("0")


def test_borda_da_janela_conta_o_dia_365():
    pet = PetFactory()
    atendimento(pet, dias_atras=365)

    assert anotado(pet).qtd_visitas == 1


def test_soma_de_gasto_independe_da_contagem():
    pet = PetFactory()
    atendimento(pet, 3, valor="600.00")

    assert anotado(pet).qtd_visitas == 1
    assert anotado(pet).total_gasto == Decimal("600.00")


def test_nao_multiplica_soma_com_varios_atendimentos():
    """Count e Sum na mesma annotate percorrem uma só relação; nada de produto cartesiano."""
    pet = PetFactory()
    for dias in (1, 2, 3, 4):
        atendimento(pet, dias, valor="25.00")

    assert anotado(pet).qtd_visitas == 4
    assert anotado(pet).total_gasto == Decimal("100.00")
