from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from core.services import custos_por_categoria, dashboard_periodo, pets_vip, top_tutores
from tests.factories import (
    AtendimentoFactory,
    CustoFactory,
    PacoteContratadoFactory,
    PetFactory,
    RetiradaFactory,
    TutorFactory,
)

pytestmark = pytest.mark.django_db


def test_dashboard_periodo_caminho_feliz():
    PacoteContratadoFactory(
        valor_pago=Decimal("220.00"),
        data_compra=date(2026, 6, 5),
        competencia=date(2026, 6, 1),
    )
    AtendimentoFactory(
        valor=Decimal("95.00"),
        data=date(2026, 6, 10),
        status="Liberado",
    )
    CustoFactory(valor=Decimal("100.00"), competencia=date(2026, 6, 1))
    RetiradaFactory(valor=Decimal("50.00"), data=date(2026, 6, 15))

    resultado = dashboard_periodo(date(2026, 6, 1), date(2026, 6, 30))

    assert resultado["faturamento"] == Decimal("315.00")
    assert resultado["custos"] == Decimal("100.00")
    assert resultado["lucro"] == Decimal("215.00")
    assert resultado["retiradas"] == Decimal("50.00")


def test_dashboard_periodo_ticket_medio_e_margem():
    PacoteContratadoFactory(
        valor_pago=Decimal("200.00"),
        data_compra=date(2026, 6, 5),
        competencia=date(2026, 6, 1),
    )
    AtendimentoFactory(
        valor=Decimal("100.00"),
        data=date(2026, 6, 10),
        status="Liberado",
    )
    CustoFactory(valor=Decimal("60.00"), competencia=date(2026, 6, 1))

    resultado = dashboard_periodo(date(2026, 6, 1), date(2026, 6, 30))

    # faturamento 300 (200 pacote + 100 avulso) / 2 atendimentos (1 pacote + 1 avulso)
    assert resultado["ticket_medio"] == Decimal("150.00")
    # lucro 240 (300 - 60) / faturamento 300
    assert resultado["margem"] == Decimal("0.80")


def test_dashboard_periodo_sem_movimento_nao_quebra():
    resultado = dashboard_periodo(date(2026, 6, 1), date(2026, 6, 30))

    assert resultado["ticket_medio"] == Decimal("0")
    assert resultado["margem"] == Decimal("0")


def test_pets_vip_por_visitas_ou_gasto():
    pet_por_visitas = PetFactory()
    for dia in (5, 12, 19):
        AtendimentoFactory(
            pet=pet_por_visitas, status="Liberado",
            valor=Decimal("50.00"), data=date(2026, 6, dia),
        )

    pet_por_gasto = PetFactory()
    AtendimentoFactory(
        pet=pet_por_gasto, status="Liberado",
        valor=Decimal("600.00"), data=date(2026, 6, 10),
    )

    pet_comum = PetFactory()
    AtendimentoFactory(
        pet=pet_comum, status="Liberado",
        valor=Decimal("100.00"), data=date(2026, 6, 10),
    )

    resultado = list(pets_vip(date(2026, 6, 1), date(2026, 6, 30)))

    assert pet_por_visitas in resultado
    assert pet_por_gasto in resultado
    assert pet_comum not in resultado


def test_top_tutores_por_gasto_total():
    tutor_a = TutorFactory()
    pet_a = PetFactory(tutor=tutor_a)
    AtendimentoFactory(
        pet=pet_a, status="Liberado",
        valor=Decimal("300.00"), data=date(2026, 6, 5),
    )

    tutor_b = TutorFactory()
    pet_b1 = PetFactory(tutor=tutor_b)
    pet_b2 = PetFactory(tutor=tutor_b)
    AtendimentoFactory(
        pet=pet_b1, status="Liberado",
        valor=Decimal("100.00"), data=date(2026, 6, 5),
    )
    AtendimentoFactory(
        pet=pet_b2, status="Liberado",
        valor=Decimal("100.00"), data=date(2026, 6, 6),
    )

    tutor_c = TutorFactory()
    pet_c = PetFactory(tutor=tutor_c)
    AtendimentoFactory(
        pet=pet_c, status="Liberado",
        valor=Decimal("50.00"), data=date(2026, 6, 5),
    )

    resultado = list(top_tutores(date(2026, 6, 1), date(2026, 6, 30), limite=2))

    assert resultado[0] == tutor_a
    assert resultado[1] == tutor_b
    assert tutor_c not in resultado


def test_dashboard_margem_e_ticket_quantizados():
    # 220 pacote + 95 avulso = 315; custo 100 -> margem 215/315 = 0.6825...
    PacoteContratadoFactory(
        valor_pago=Decimal("220.00"),
        data_compra=date(2026, 6, 5),
        competencia=date(2026, 6, 1),
    )
    AtendimentoFactory(valor=Decimal("95.00"), data=date(2026, 6, 10), status="Liberado")
    CustoFactory(valor=Decimal("100.00"), competencia=date(2026, 6, 1))

    resultado = dashboard_periodo(date(2026, 6, 1), date(2026, 6, 30))

    assert resultado["ticket_medio"] == Decimal("157.50")
    assert resultado["margem"] == Decimal("0.6825")


def test_vip_exclui_pet_inativo():
    pet = PetFactory(ativo=False)
    for dia in (5, 12, 19):
        AtendimentoFactory(
            pet=pet, status="Liberado", valor=Decimal("50.00"), data=date(2026, 6, dia),
        )

    assert pet not in list(pets_vip(date(2026, 6, 1), date(2026, 6, 30)))


def test_top_tutores_exclui_tutor_inativo():
    tutor = TutorFactory(ativo=False)
    pet = PetFactory(tutor=tutor)
    AtendimentoFactory(
        pet=pet, status="Liberado", valor=Decimal("900.00"), data=date(2026, 6, 5),
    )

    assert tutor not in list(top_tutores(date(2026, 6, 1), date(2026, 6, 30)))


def test_dashboard_endpoint_retorna_kpis(api):
    PacoteContratadoFactory(
        valor_pago=Decimal("220.00"),
        data_compra=date(2026, 6, 5),
        competencia=date(2026, 6, 1),
    )
    resp = api.get("/api/dashboard/?inicio=2026-06-01&fim=2026-06-30")
    assert resp.status_code == 200
    body = resp.json()
    for chave in [
        "faturamento", "custos", "retiradas", "lucro",
        "ticket_medio", "margem", "vip", "top_tutores",
    ]:
        assert chave in body


def test_dashboard_endpoint_valores_monetarios_como_string(api):
    PacoteContratadoFactory(
        valor_pago=Decimal("220.00"),
        data_compra=date(2026, 6, 5),
        competencia=date(2026, 6, 1),
    )
    body = api.get("/api/dashboard/?inicio=2026-06-01&fim=2026-06-30").json()

    assert body["faturamento"] == "220.00"
    assert body["ticket_medio"] == "220.00"
    assert body["margem"] == "1.0000"


def test_dashboard_endpoint_exige_auth():
    resp = APIClient().get("/api/dashboard/?inicio=2026-06-01&fim=2026-06-30")
    assert resp.status_code == 401


def test_dashboard_endpoint_sem_params_retorna_400(api):
    assert api.get("/api/dashboard/").status_code == 400


def test_dashboard_endpoint_data_invalida_retorna_400(api):
    resp = api.get("/api/dashboard/?inicio=banana&fim=2026-06-30")
    assert resp.status_code == 400


def test_dashboard_marca_pets_vip_como_vip(api):
    """pets_vip anota os mesmos dois campos, então o booleano derivado bate."""
    pet = PetFactory()
    for dia in (5, 12, 19):
        AtendimentoFactory(
            pet=pet, status="Liberado",
            valor=Decimal("50.00"), data=date(2026, 6, dia),
        )

    resp = api.get("/api/dashboard/?inicio=2026-06-01&fim=2026-06-30")

    assert resp.json()["vip"][0]["vip"] is True


def test_custos_por_categoria_soma_e_ordena_desc():
    CustoFactory(categoria="Insumos", valor=Decimal("300.00"), competencia=date(2026, 6, 1))
    CustoFactory(categoria="Insumos", valor=Decimal("200.00"), competencia=date(2026, 6, 1))
    CustoFactory(categoria="Aluguel", valor=Decimal("900.00"), competencia=date(2026, 6, 1))

    resultado = custos_por_categoria(date(2026, 6, 1), date(2026, 6, 30))

    assert [(linha["categoria"], linha["valor"]) for linha in resultado] == [
        ("Aluguel", Decimal("900.00")),
        ("Insumos", Decimal("500.00")),
    ]


def test_custos_por_categoria_funde_variacoes_de_digitacao():
    """`categoria` é texto livre: "Aluguel", "aluguel" e "Aluguel " são o mesmo custo.

    Sem a chave normalizada, o gráfico mostraria três fatias do mesmo aluguel.
    """
    CustoFactory(categoria="Aluguel", valor=Decimal("100.00"), competencia=date(2026, 6, 1))
    CustoFactory(categoria="aluguel", valor=Decimal("100.00"), competencia=date(2026, 6, 1))
    CustoFactory(categoria="Aluguel ", valor=Decimal("100.00"), competencia=date(2026, 6, 1))

    resultado = custos_por_categoria(date(2026, 6, 1), date(2026, 6, 30))

    assert len(resultado) == 1
    assert resultado[0]["valor"] == Decimal("300.00")
    # O rótulo sai como a Patricia digitou (sem espaço à toa); só a chave é normalizada.
    assert resultado[0]["categoria"].strip().lower() == "aluguel"


def test_custos_por_categoria_rotula_vazio_como_sem_categoria():
    CustoFactory(categoria="", valor=Decimal("50.00"), competencia=date(2026, 6, 1))
    CustoFactory(categoria="   ", valor=Decimal("30.00"), competencia=date(2026, 6, 1))

    resultado = custos_por_categoria(date(2026, 6, 1), date(2026, 6, 30))

    assert resultado == [{"categoria": "Sem categoria", "valor": Decimal("80.00")}]


def test_custos_por_categoria_agrupa_cauda_em_outros():
    for i, valor in enumerate([600, 500, 400, 300, 200], start=1):
        CustoFactory(
            categoria=f"Categoria {i}", valor=Decimal(valor), competencia=date(2026, 6, 1),
        )
    CustoFactory(categoria="Cauda A", valor=Decimal("70.00"), competencia=date(2026, 6, 1))
    CustoFactory(categoria="Cauda B", valor=Decimal("30.00"), competencia=date(2026, 6, 1))

    resultado = custos_por_categoria(date(2026, 6, 1), date(2026, 6, 30))

    assert len(resultado) == 6
    assert resultado[-1] == {"categoria": "Outros", "valor": Decimal("100.00")}


def test_custos_por_categoria_respeita_o_periodo():
    CustoFactory(categoria="Aluguel", valor=Decimal("900.00"), competencia=date(2026, 5, 1))

    assert custos_por_categoria(date(2026, 6, 1), date(2026, 6, 30)) == []


def test_dashboard_endpoint_inclui_custos_por_categoria(api):
    CustoFactory(categoria="Insumos", valor=Decimal("120.00"), competencia=date(2026, 6, 1))

    body = api.get("/api/dashboard/?inicio=2026-06-01&fim=2026-06-30").json()

    assert body["custos_por_categoria"] == [{"categoria": "Insumos", "valor": "120.00"}]
