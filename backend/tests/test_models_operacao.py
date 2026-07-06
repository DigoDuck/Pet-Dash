from datetime import date
from decimal import Decimal

import pytest
from django.db import IntegrityError

from core.models import Atendimento
from tests.factories import (
    AtendimentoFactory,
    CustoFactory,
    PacoteContratadoFactory,
    PagamentoFactory,
    RetiradaFactory,
)

pytestmark = pytest.mark.django_db

def test_um_pacote_por_pet_por_competencia():
    primeiro = PacoteContratadoFactory(competencia=date(2026, 7, 6))

    with pytest.raises(IntegrityError):
        PacoteContratadoFactory(pet=primeiro.pet, competencia=date(2026, 7, 20))
        
def test_pets_diferentes_podem_ter_pacote_na_mesma_competencia():
    primeiro = PacoteContratadoFactory()
    PacoteContratadoFactory(competencia=primeiro.competencia)  # pet diferente, não levanta
    

def test_saldo_ocupado_por_liberados_e_pendentes():
    pacote = PacoteContratadoFactory(qtd_total=4)
    
    AtendimentoFactory(pacote=pacote, pet=pacote.pet, status=Atendimento.Status.LIBERADO)
    AtendimentoFactory(pacote=pacote, pet=pacote.pet, status=Atendimento.Status.LIBERADO)
    AtendimentoFactory(pacote=pacote, pet=pacote.pet, status=Atendimento.Status.PENDENTE)

    assert pacote.saldo() == 1
    
def test_cancelado_devolve_credito_sem_apagar_historico():
    pacote = PacoteContratadoFactory(qtd_total=4)
    atendimento = AtendimentoFactory(
        pacote=pacote, pet=pacote.pet, status=Atendimento.Status.PENDENTE
    )
    assert pacote.saldo() == 3 # 1 atendimento ocupando, de 4
    
    atendimento.status = Atendimento.Status.CANCELADO
    atendimento.save()
    
    assert pacote.saldo() == 4 # crédito devolvido
    assert pacote.atendimentos.count() == 1 # histórico mantido
    
def test_consumo_de_pacote_guarda_valor_de_referencia():
    pacote = PacoteContratadoFactory()
    atendimento = AtendimentoFactory(
        pacote=pacote,
        pet=pacote.pet,
        valor=Decimal("95.00"),
        status=Atendimento.Status.LIBERADO
    )
    assert atendimento.valor == Decimal("95.00")
    
def test_queryset_avulsos_liberados_no_periodo():
    avulso_no_periodo = AtendimentoFactory(
        status=Atendimento.Status.LIBERADO, data=date(2026, 6, 10)
    )
    AtendimentoFactory(
    status=Atendimento.Status.PENDENTE, data=date(2026, 6, 11)
    ) # pendente deveria sumir
    AtendimentoFactory(
    status=Atendimento.Status.LIBERADO, data=date(2026, 5, 10)
    ) # mês errado deveria sumir
    pacote = PacoteContratadoFactory()
    AtendimentoFactory(
        pacote=pacote, pet=pacote.pet,
        status=Atendimento.Status.LIBERADO, data=date(2026, 6, 12),
    ) # tem pacote, deveria sumir
    
    resultado = Atendimento.objects.avulsos().liberados().no_periodo(
        date(2026, 6, 1), date(2026, 6, 30)
    )
    assert list(resultado) == [avulso_no_periodo]


def test_pagamento_misto_sao_duas_linhas():
    # Invariante #8: pagamento misto = N linhas na tabela Pagamento, não enum.
    atendimento = AtendimentoFactory(valor=Decimal("120.00"))
    PagamentoFactory(atendimento=atendimento, metodo="Pix", valor=Decimal("80.00"))
    PagamentoFactory(atendimento=atendimento, metodo="Dinheiro", valor=Decimal("40.00"))
    assert atendimento.pagamentos.count() == 2


def test_custo_tem_tipo_e_competencia_mensal():
    custo = CustoFactory(competencia=date(2026, 6, 1))
    assert custo.tipo == "fixo"
    assert custo.competencia == date(2026, 6, 1)


def test_retirada_registra_valor_e_data():
    retirada = RetiradaFactory()
    assert retirada.valor == Decimal("500.00")
    assert retirada.data == date(2026, 6, 15)