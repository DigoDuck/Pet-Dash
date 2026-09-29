"""O pacote vale pela VALIDADE, não pelo mês da competência (invariante 5).

Buscar só pela competência exata fazia o banho de 05/10 de um pacote de setembro com
validade estendida até 08/10 nascer avulso sem aviso: faturado em dobro e com o crédito
pago perdido. Era a queixa da Patricia ("achei que ia sair do pacote e virou avulso").
"""

from datetime import date

import pytest

from tests.factories import (
    AtendimentoFactory,
    PacoteContratadoFactory,
    PetFactory,
    ServicoFactory,
)

pytestmark = pytest.mark.django_db


def pacote_de_setembro(**kwargs):
    campos = {
        "competencia": date(2026, 9, 1),
        "data_compra": date(2026, 9, 2),
        "validade": date(2026, 9, 30),
    }
    return PacoteContratadoFactory(**{**campos, **kwargs})


def buscar(api, pet_id, data):
    return api.get(f"/api/pets/{pet_id}/pacote-ativo/?data={data}")


def test_validade_estendida_cobre_o_banho_do_mes_seguinte(api):
    pacote = pacote_de_setembro(validade=date(2026, 10, 8))

    resp = buscar(api, pacote.pet_id, "2026-10-05")

    assert resp.status_code == 200
    assert resp.data["id"] == pacote.id


def test_validade_encurtada_nao_cobre_o_fim_do_mes(api):
    pacote = pacote_de_setembro(validade=date(2026, 9, 27))

    assert buscar(api, pacote.pet_id, "2026-09-29").status_code == 204


def test_antes_da_competencia_e_da_compra_nao_cobre(api):
    pacote = pacote_de_setembro()

    assert buscar(api, pacote.pet_id, "2026-08-20").status_code == 204


def test_compra_antecipada_ja_cobre_desde_o_dia_da_venda(api):
    pacote = pacote_de_setembro(data_compra=date(2026, 8, 30))

    assert buscar(api, pacote.pet_id, "2026-08-30").data["id"] == pacote.id


def test_dois_pacotes_valendo_consome_primeiro_o_que_vence_antes(api):
    setembro = pacote_de_setembro(validade=date(2026, 10, 8))
    outubro = PacoteContratadoFactory(
        pet=setembro.pet, competencia=date(2026, 10, 1),
        data_compra=date(2026, 9, 28), validade=date(2026, 10, 31),
    )

    assert buscar(api, setembro.pet_id, "2026-10-05").data["id"] == setembro.id

    # Setembro esgotado: o banho passa a sair do pacote de outubro.
    for _ in range(setembro.qtd_total):
        AtendimentoFactory(pet=setembro.pet, pacote=setembro, status="Liberado")
    assert buscar(api, setembro.pet_id, "2026-10-05").data["id"] == outubro.id


def test_sem_credito_devolve_o_pacote_para_a_tela_avisar(api):
    pacote = pacote_de_setembro(qtd_total=1)
    AtendimentoFactory(pet=pacote.pet, pacote=pacote, status="Pendente")

    resp = buscar(api, pacote.pet_id, "2026-09-15")

    assert resp.data["id"] == pacote.id
    assert resp.data["saldo"] == 0


def test_cancelado_devolve_o_credito_para_a_busca(api):
    pacote = pacote_de_setembro(qtd_total=1)
    AtendimentoFactory(pet=pacote.pet, pacote=pacote, status="Cancelado")

    assert buscar(api, pacote.pet_id, "2026-09-15").data["saldo"] == 1


def test_data_invalida_devolve_400(api):
    pacote = pacote_de_setembro()

    assert buscar(api, pacote.pet_id, "banana").status_code == 400


def test_pacote_desativado_nao_cobre(api):
    pacote = pacote_de_setembro(ativo=False)

    assert buscar(api, pacote.pet_id, "2026-09-15").status_code == 204


def test_venda_com_validade_antes_da_competencia_da_400(api):
    """Janela vazia: o pacote pago nunca seria achado e o mês inteiro faturaria em dobro."""
    pet = PetFactory()
    servico = ServicoFactory(is_pacote=True, creditos=4)
    payload = {
        "pet": pet.id, "servico": servico.id, "competencia": "2026-09-01",
        "qtd_total": 4, "valor_pago": "350.00", "data_compra": "2026-09-02",
        "validade": "2026-08-30",
    }

    resp = api.post("/api/pacotes/", payload, format="json")

    assert resp.status_code == 400
    assert "validade" in resp.data


def test_validade_encurtada_dentro_do_mes_e_aceita(api):
    pacote = pacote_de_setembro()

    resp = api.patch(f"/api/pacotes/{pacote.id}/", {"validade": "2026-09-27"}, format="json")

    assert resp.status_code == 200
