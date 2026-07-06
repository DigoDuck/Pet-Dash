from datetime import date
from decimal import Decimal

import pytest

from core.models import Atendimento
from core.services import faturamento_periodo
from tests.factories import AtendimentoFactory, PacoteContratadoFactory

pytestmark = pytest.mark.django_db

INICIO_JUN = date(2026, 6, 1)
FIM_JUN = date(2026, 6, 30)


def test_faturamento_soma_pacote_vendido_e_avulso_liberado():
    PacoteContratadoFactory(valor_pago=Decimal("220.00"), data_compra=date(2026, 6, 3))
    AtendimentoFactory(
        valor=Decimal("95.00"), status=Atendimento.Status.LIBERADO, data=date(2026, 6, 10)
    )
    assert faturamento_periodo(INICIO_JUN, FIM_JUN) == Decimal("315.00")


def test_consumo_de_pacote_nao_conta_duas_vezes():
    pacote = PacoteContratadoFactory(valor_pago=Decimal("220.00"), data_compra=date(2026, 6, 3))
    AtendimentoFactory(
        pacote=pacote, pet=pacote.pet, valor=Decimal("65.00"),
        status=Atendimento.Status.LIBERADO, data=date(2026, 6, 10),
    )
    assert faturamento_periodo(INICIO_JUN, FIM_JUN) == Decimal("220.00")
    
    
def test_avulso_pendente_nao_fatura():
    AtendimentoFactory(
        valor=Decimal("95.00"), status=Atendimento.Status.PENDENTE, data=date(2026, 6, 15)
    )
    assert faturamento_periodo(INICIO_JUN, FIM_JUN) == Decimal("0")
    

def test_faturamento_respeita_o_periodo():
    PacoteContratadoFactory(
        valor_pago=Decimal("220.00"),
        data_compra=date(2026, 5, 28),
        competencia=date(2026, 5, 1),
        validade=date(2026, 5, 31),
    )
    AtendimentoFactory(
        valor=Decimal("95.00"), status=Atendimento.Status.LIBERADO, data=date(2026, 7, 1)
    )
    assert faturamento_periodo(INICIO_JUN, FIM_JUN) == Decimal("0")
    
    
def test_mes_cheio_da_patricia():
    pacote = PacoteContratadoFactory(valor_pago=Decimal("220.00"), data_compra=date(2026, 6, 2))
    for dia in (2, 9, 16, 23):
        AtendimentoFactory(
            pacote=pacote, pet=pacote.pet, valor=Decimal("65.00"),
            status=Atendimento.Status.LIBERADO, data=date(2026, 6, dia),
        )
    AtendimentoFactory(
        valor=Decimal("95.00"), status=Atendimento.Status.LIBERADO, data=date(2026, 6, 15)
    )
    AtendimentoFactory(
        valor=Decimal("95.00"), status=Atendimento.Status.LIBERADO, data=date(2026, 6, 20)
    )
    assert faturamento_periodo(INICIO_JUN, FIM_JUN) == Decimal("410.00")