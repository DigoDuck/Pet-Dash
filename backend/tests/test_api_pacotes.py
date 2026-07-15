from datetime import date

import pytest

pytestmark = pytest.mark.django_db


def test_vende_pacote_e_expoe_saldo(api):
    from tests.factories import PetFactory, ServicoFactory
    pet = PetFactory()
    servico = ServicoFactory(is_pacote=True, creditos=4)
    payload = {
        "pet": pet.id, "servico": servico.id, "competencia": "2026-06-15",
        "qtd_total": 4, "valor_pago": "220.00", "data_compra": "2026-06-01",
        "validade": "2026-06-30",
    }
    resp = api.post("/api/pacotes/", payload, format="json")
    assert resp.status_code == 201
    assert resp.json()["saldo"] == 4
    assert resp.json()["competencia"] == "2026-06-01"  # normalizado


def test_pacote_duplicado_no_mes_da_400(api):
    from tests.factories import PacoteContratadoFactory
    pacote = PacoteContratadoFactory(competencia=date(2026, 6, 1))
    payload = {
        "pet": pacote.pet.id, "servico": pacote.servico.id, "competencia": "2026-06-20",
        "qtd_total": 4, "valor_pago": "220.00", "data_compra": "2026-06-02",
        "validade": "2026-06-30",
    }
    resp = api.post("/api/pacotes/", payload, format="json")
    assert resp.status_code == 400


def test_endpoint_pacote_ativo_do_pet(api):
    from tests.factories import PacoteContratadoFactory
    pacote = PacoteContratadoFactory(competencia=date(2026, 6, 1))
    resp = api.get(f"/api/pets/{pacote.pet.id}/pacote-ativo/?competencia=2026-06-01")
    assert resp.status_code == 200
    assert resp.json()["id"] == pacote.id
    assert resp.json()["saldo"] == 4


def test_lista_filtra_por_competencia_e_traz_nomes(api):
    from tests.factories import PacoteContratadoFactory

    pacote = PacoteContratadoFactory(competencia=date(2026, 6, 1))
    PacoteContratadoFactory(competencia=date(2026, 7, 1))

    resp = api.get("/api/pacotes/?competencia=2026-06-01")

    assert resp.status_code == 200
    dados = resp.json()
    assert dados["count"] == 1
    item = dados["results"][0]
    assert item["id"] == pacote.id
    assert item["pet_nome"] == pacote.pet.nome
    assert item["tutor_nome"] == pacote.pet.tutor.nome
    assert item["servico_nome"] == pacote.servico.nome
    assert item["saldo"] == 4


def test_pacote_com_servico_avulso_da_400(api):
    from tests.factories import PetFactory, ServicoFactory

    pet = PetFactory()
    banho = ServicoFactory(is_pacote=False)
    payload = {
        "pet": pet.id, "servico": banho.id, "competencia": "2026-06-01",
        "qtd_total": 4, "valor_pago": "60.00", "data_compra": "2026-06-01",
        "validade": "2026-06-30",
    }

    resp = api.post("/api/pacotes/", payload, format="json")

    assert resp.status_code == 400
    assert "servico" in resp.json()


def test_trocar_para_servico_avulso_no_patch_da_400(api):
    from tests.factories import PacoteContratadoFactory, ServicoFactory

    pacote = PacoteContratadoFactory(competencia=date(2026, 6, 1))
    banho = ServicoFactory(is_pacote=False)

    resp = api.patch(f"/api/pacotes/{pacote.id}/", {"servico": banho.id}, format="json")

    assert resp.status_code == 400


def test_patch_parcial_nao_revalida_servico_herdado(api):
    """Serviço que virou avulso DEPOIS da venda não pode travar a edição.

    Cenário real: a Patricia reorganiza o catálogo em setembro e desmarca o
    is_pacote do serviço; o pacote de junho continua legítimo e precisa aceitar
    reagendamento (invariante 5).
    """
    from tests.factories import PacoteContratadoFactory

    pacote = PacoteContratadoFactory(competencia=date(2026, 6, 1))
    pacote.servico.is_pacote = False
    pacote.servico.save()

    resp = api.patch(
        f"/api/pacotes/{pacote.id}/", {"validade": "2026-07-05"}, format="json"
    )

    assert resp.status_code == 200
    assert resp.json()["validade"] == "2026-07-05"


def test_busca_pacote_pelo_nome_do_pet(api):
    from tests.factories import PacoteContratadoFactory, PetFactory

    alvo = PacoteContratadoFactory(pet=PetFactory(nome="Rex"), competencia=date(2026, 6, 1))
    PacoteContratadoFactory(pet=PetFactory(nome="Luna"), competencia=date(2026, 6, 1))

    resp = api.get("/api/pacotes/?search=Rex")

    assert resp.status_code == 200
    assert [p["id"] for p in resp.json()["results"]] == [alvo.id]