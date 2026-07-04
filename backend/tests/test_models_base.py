import pytest
from django.db.models.deletion import ProtectedError

from tests.factories import PetFactory, ServicoFactory, TutorFactory

pytestmark = pytest.mark.django_db


def test_tutor_nasce_ativo_com_email_opcional():
    tutor = TutorFactory()
    assert tutor.ativo is True
    assert tutor.email == ""


def test_pet_nasce_ativo_e_pertence_ao_tutor():
    pet = PetFactory()
    assert pet.ativo is True
    assert pet in pet.tutor.pets.all()


def test_deletar_tutor_com_pet_e_bloqueado():
    # Soft-delete é a regra; hard-delete com histórico deve ser impossível.
    pet = PetFactory()
    with pytest.raises(ProtectedError):
        pet.tutor.delete()


def test_servico_avulso_nao_tem_creditos():
    servico = ServicoFactory()
    assert servico.is_pacote is False
    assert servico.creditos is None
