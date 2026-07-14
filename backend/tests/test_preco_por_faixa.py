"""Preço por faixa de peso.

A Patricia precifica por peso (até 10kg · 10 a 15kg · acima de 15kg), não por porte
subjetivo. O catálogo guarda os três preços; `Atendimento.valor` continua sendo o
snapshot do que foi cobrado no dia (invariante 7) — o preço do catálogo é sugestão.
"""

from decimal import Decimal

import pytest
from django.core.management import call_command

from core.models import Servico
from tests.factories import ServicoFactory

pytestmark = pytest.mark.django_db


def test_sugere_o_preco_da_faixa_do_pet():
    banho = ServicoFactory(
        nome="Banho",
        preco_padrao=Decimal("65.00"),
        preco_m=Decimal("120.00"),
        preco_g=Decimal("150.00"),
    )

    assert banho.preco_para("P") == Decimal("65.00")
    assert banho.preco_para("M") == Decimal("120.00")
    assert banho.preco_para("G") == Decimal("150.00")


def test_faixa_sem_preco_proprio_cai_no_preco_do_pequeno():
    """Acima de 15kg a Patricia só deu preço do banho; os outros serviços ficam sem.

    O fallback nunca devolve None: um campo de preço vazio no formulário faria ela
    digitar do zero em todo atendimento de pet grande. Sugestão baixa ela corrige;
    campo vazio ela xinga.
    """
    hidratacao = ServicoFactory(
        nome="Hidratação", preco_padrao=Decimal("30.00"), preco_m=None, preco_g=None
    )

    assert hidratacao.preco_para("G") == Decimal("30.00")
    assert hidratacao.preco_para("M") == Decimal("30.00")


def test_pet_sem_porte_cadastrado_usa_o_preco_do_pequeno():
    """`porte` é opcional no cadastro (string vazia). Não pode quebrar a sugestão."""
    banho = ServicoFactory(preco_padrao=Decimal("65.00"), preco_m=Decimal("120.00"))

    assert banho.preco_para("") == Decimal("65.00")


def test_seed_cria_o_catalogo_da_tabela_real():
    call_command("seed_catalogo")

    assert Servico.objects.count() == 10

    banho = Servico.objects.get(nome="Banho")
    assert banho.preco_padrao == Decimal("65.00")   # até 10 kg
    assert banho.preco_m == Decimal("120.00")       # 10 a 15 kg
    assert banho.preco_g == Decimal("150.00")       # acima de 15 kg

    tesoura = Servico.objects.get(nome="Tosa na tesoura (bebê)")
    assert tesoura.preco_padrao == Decimal("120.00")
    assert tesoura.preco_m == Decimal("250.00")
    # Ela não deu preço de grande para tosa; fica vazio em vez de inventado.
    assert tesoura.preco_g is None

    pacote = Servico.objects.get(nome="Pacote Fidelidade")
    assert pacote.is_pacote is True
    assert pacote.creditos == 4


def test_seed_e_idempotente():
    """Roda em produção pelo shell. Rodar duas vezes por engano não pode duplicar."""
    call_command("seed_catalogo")
    call_command("seed_catalogo")

    assert Servico.objects.count() == 10


def test_seed_nao_sobrescreve_preco_editado_pela_usuaria():
    """A garantia que protege o dado da cliente.

    `get_or_create` e não `update_or_create`: se a Patricia corrigiu o preço pela tela,
    rodar o seed de novo não pode desfazer a correção dela.
    """
    call_command("seed_catalogo")
    banho = Servico.objects.get(nome="Banho")
    banho.preco_g = Decimal("350.00")  # o Chow Chow que ela cobra 300-350
    banho.save()

    call_command("seed_catalogo")

    banho.refresh_from_db()
    assert banho.preco_g == Decimal("350.00")


def test_seed_roda_com_debug_desligado(settings):
    """O inverso do teste do seed_dev, e o motivo dele existir.

    O `seed_dev` aborta quando DEBUG=False, de propósito (dados fictícios não podem
    tocar produção). Este comando é o oposto: se alguém copiar aquele guard para cá,
    o catálogo nunca roda em produção — o único lugar onde ele precisa rodar.
    """
    settings.DEBUG = False

    call_command("seed_catalogo")

    assert Servico.objects.count() == 10
