# PR 10 · `feat/front-clientes` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Primeira fatia vertical de dados reais do frontend — Clientes & Pets, com lista e busca de tutores, cadastro e edição em modal, detalhe do pet com histórico paginado e badge VIP calculado no backend.

**Architecture:** O PR abre com três adições read-only no backend (`services.anota_vip`, campos derivados no `PetSerializer`, `servico_nome` no `AtendimentoSerializer`) e um comando de seed, sem tocar em model nem migration. O frontend segue a estrutura por camada do PR 9: tipos e hooks do TanStack Query em `lib/` e `hooks/`, primitivos em `components/ui/`, componentes de domínio em `components/clientes/`, três páginas novas. A regra do VIP vive só no backend; o frontend lê um booleano.

**Tech Stack:** Django 5 + DRF · pytest-django + factory_boy · React 19 + TypeScript · TanStack Query v5 · react-hook-form + zod · `@radix-ui/react-dialog` (única dependência nova) · Vitest + Testing Library + MSW v2.

**Spec:** `docs/specs/2026-07-10-pr10-front-clientes-design.md` (aprovado 2026-07-10).

## Global Constraints

- Branch: `feat/front-clientes` (já criado, a partir de `main` no commit `33a7fbd`).
- **Nenhuma migration neste PR.** Nada de model muda. Se `makemigrations` gerar arquivo, algo está errado.
- Critério VIP (invariante 6 do `CLAUDE.md`): `qtd_visitas >= 3` **OU** `total_gasto >= 500`, contando só atendimentos com status `Liberado`, numa janela de **365 dias**.
- `services.pets_vip(inicio, fim)` **não muda**. Serve o dashboard, com semântica de período.
- `Atendimento.Status`: `"Liberado"`, `"Pendente"`, `"Cancelado"` (valor igual ao label).
- `Pet.porte`: `""` (não informado), `"P"`, `"M"`, `"G"`.
- Paginação DRF: `PageNumberPagination`, `PAGE_SIZE = 50`, sem `page_size_query_param`. Resposta `{count, next, previous, results}`.
- Consumo de pacote se identifica por `pacote != null`, **nunca** por valor zero (invariante 2).
- Código, comentários e copy da UI em **português**. Commits em **inglês**, conventional, **sem** trailer de coautoria.
- Tokens Tailwind (já em `src/styles/index.css`): marsala, marsala-light, marsala-dark, ouro, ouro-light, ouro-muted, creme, fundo, escuro, escuro-suave, neutro, neutro-light, sucesso, erro. Fontes: `font-display`, `font-mono`.
- Proibido: axios, Radix além do `react-dialog`, shadcn/ui, materializar valor financeiro, criar `qtd_usada`.
- Comandos (Windows, a partir de `backend/`): `./.venv/Scripts/python.exe -m pytest`, `./.venv/Scripts/python.exe -m ruff check .`. A partir de `frontend/`: `npm run test`, `npm run build`.

---

## Estrutura de arquivos

**Backend**

| Arquivo | Responsabilidade |
|---|---|
| `backend/core/services.py` | + `anota_vip(queryset, hoje)` e as constantes do critério. Não toca `pets_vip` |
| `backend/core/serializers.py` | `PetSerializer` deriva `vip`/`qtd_visitas`/`total_gasto`; `AtendimentoSerializer` ganha `servico_nome` |
| `backend/core/views.py` | `PetViewSet.get_queryset()` passa pelo `anota_vip` |
| `backend/core/management/commands/seed_dev.py` | Seed de desenvolvimento, ORM puro, guard de `DEBUG` |
| `backend/tests/test_vip.py` | Testes unitários de `anota_vip` (sem HTTP) |
| `backend/tests/test_api_cadastros.py` | Testes de API dos campos novos do pet |
| `backend/tests/test_api_atendimentos.py` | Teste do `servico_nome` |
| `backend/tests/test_seed_dev.py` | Guard de `DEBUG` e idempotência |

**Frontend**

| Arquivo | Responsabilidade |
|---|---|
| `frontend/src/lib/types.ts` | `Paginated<T>`, `Tutor`, `Pet`, `Atendimento`, `Pagamento` |
| `frontend/src/lib/queryClient.ts` | Flag module-level contra redirect múltiplo |
| `frontend/src/hooks/useTutores.ts` | Query keys, lista, detalhe e mutations de tutor |
| `frontend/src/hooks/usePets.ts` | Query keys, lista por tutor, detalhe e mutations de pet |
| `frontend/src/hooks/useAtendimentos.ts` | Histórico paginado por pet |
| `frontend/src/components/ui/Modal.tsx` | Radix Dialog com as classes da marca |
| `frontend/src/components/ui/Select.tsx` | Wrapper do `<select>` nativo, espelha o `Input` |
| `frontend/src/components/ui/Input.tsx` | + `useId()` como fallback de `id` |
| `frontend/src/components/ui/Paginacao.tsx` | Anterior/Próxima e "página X de Y" |
| `frontend/src/components/EstadoVazio.tsx` | Estado vazio de lista |
| `frontend/src/components/ErroAoCarregar.tsx` | Estado de erro com "tentar de novo" |
| `frontend/src/components/clientes/TutorForm.tsx` | Formulário de tutor (criar e editar) |
| `frontend/src/components/clientes/PetForm.tsx` | Formulário de pet (criar e editar) |
| `frontend/src/components/clientes/PetCard.tsx` | Card do pet com badge VIP |
| `frontend/src/components/clientes/HistoricoTabela.tsx` | Tabela do histórico de atendimentos |
| `frontend/src/pages/Clientes.tsx` | Lista de tutores, busca, paginação |
| `frontend/src/pages/TutorDetalhe.tsx` | Tutor, seus pets, editar, desativar |
| `frontend/src/pages/PetDetalhe.tsx` | Pet, badge VIP, histórico |
| `frontend/src/routes/router.tsx` | + `/clientes/:id` e `/pets/:id` |
| `frontend/src/test/utils.tsx` | `renderizarComProvedores` (QueryClientProvider + MemoryRouter) |

---

### Task 1: `anota_vip` no `services.py`

**Files:**
- Modify: `backend/core/services.py`
- Test: `backend/tests/test_vip.py` (criar)

**Interfaces:**
- Consumes: `core.models.Atendimento`, `core.models.Pet`.
- Produces: `services.anota_vip(queryset, hoje) -> QuerySet[Pet]` anotado com `qtd_visitas: int` e `total_gasto: Decimal`. Constantes `VIP_MIN_VISITAS = 3`, `VIP_MIN_GASTO = Decimal("500")`, `VIP_JANELA_DIAS = 365`.

**Por que a agregação é condicional:** se filtrarmos `queryset.filter(atendimentos__status="Liberado")`, o Django emite `INNER JOIN` e todo pet sem atendimento na janela some da lista de clientes. Com `filter=Q(...)` dentro do `Count`/`Sum`, o join continua `LEFT OUTER` e o pet aparece com zero. O `test_pet_sem_atendimento_aparece_com_zeros` trava isso.

**Por que `anota_vip` não anota o booleano `vip`:** o `DashboardView` serializa `services.pets_vip(...)` com o mesmo `PetSerializer`. Se o booleano viesse do SQL do `PetViewSet`, o dashboard responderia `"vip": false` justamente para a lista de VIPs. Anotando só os dois números (que `pets_vip` também anota) e derivando o booleano no serializer, as duas telas concordam de graça.

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/tests/test_vip.py`:

```python
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
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_vip.py -v`
Expected: FAIL com `ImportError: cannot import name 'anota_vip' from 'core.services'`

- [ ] **Step 3: Implementar `anota_vip`**

Em `backend/core/services.py`, trocar o bloco de imports do topo por:

```python
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce

from core.models import Atendimento, Custo, PacoteContratado, Pet, Retirada, Tutor

VIP_MIN_VISITAS = 3
VIP_MIN_GASTO = Decimal("500")
VIP_JANELA_DIAS = 365
```

E acrescentar a função logo depois de `pets_vip` (não substituí-la):

```python
def anota_vip(queryset, hoje):
    """Anota qtd_visitas e total_gasto de cada pet na janela de 365 dias até `hoje`.

    A agregação é condicional (`filter=` dentro do Count/Sum), e não um
    `.filter()` sobre o queryset, de propósito: filtrar o join transformaria o
    LEFT OUTER em INNER e pets sem atendimento sumiriam da lista de clientes.

    Count e Sum percorrem uma única relação (`atendimentos`), então não se
    multiplicam. Ao acrescentar uma segunda relação a esta annotate, aparece
    produto cartesiano: separe em duas queries.

    O booleano `vip` é derivado no PetSerializer a partir destes dois números,
    e não anotado aqui, para que o dashboard (que serializa `pets_vip`, com
    outra janela) continue coerente sem duplicar a regra.

    `hoje` é parâmetro, não `date.today()`, para o teste ser determinístico.
    """
    na_janela = Q(
        atendimentos__status=Atendimento.Status.LIBERADO,
        atendimentos__data__gte=hoje - timedelta(days=VIP_JANELA_DIAS),
        atendimentos__data__lte=hoje,
    )
    return queryset.annotate(
        qtd_visitas=Count("atendimentos", filter=na_janela),
        total_gasto=Coalesce(
            Sum("atendimentos__valor", filter=na_janela),
            Value(Decimal("0")),
            output_field=DecimalField(max_digits=10, decimal_places=2),
        ),
    )
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_vip.py -v`
Expected: PASS, 7 passed

Run: `./.venv/Scripts/python.exe -m ruff check .`
Expected: `All checks passed!`

- [ ] **Step 5: Commit**

```bash
git add backend/core/services.py backend/tests/test_vip.py
git commit -m "feat: add anota_vip conditional aggregation over a 365-day window"
```

---

### Task 2: `PetSerializer` expõe `vip`, `qtd_visitas` e `total_gasto`

**Files:**
- Modify: `backend/core/serializers.py`
- Modify: `backend/core/views.py`
- Test: `backend/tests/test_api_cadastros.py`
- Test: `backend/tests/test_dashboard.py`

**Interfaces:**
- Consumes: `services.anota_vip`, `services.VIP_MIN_VISITAS`, `services.VIP_MIN_GASTO`.
- Produces: `GET /api/pets/` e `GET /api/pets/<id>/` devolvem `vip: bool`, `qtd_visitas: int`, `total_gasto: str` (decimal como string, padrão DRF).

**A armadilha do POST:** `get_queryset()` cobre `list`, `retrieve`, `update` e `partial_update`, mas o objeto criado pelo `create` nunca passa por ele. Um `BooleanField(read_only=True)` estouraria `AttributeError` no POST. Por isso `SerializerMethodField` com `getattr(obj, ..., default)`. Os defaults (`0`, `0`, logo `vip=False`) são semanticamente corretos para um pet recém-criado.

- [ ] **Step 1: Escrever os testes que falham**

Primeiro, **mesclar os imports no topo** de `backend/tests/test_api_cadastros.py` (não acrescentar imports ao fim: dispara E402, que está no `select` do ruff). A linha de import de factories já existe (`from tests.factories import PetFactory, ServicoFactory, TutorFactory`); trocá-la e acrescentar as duas de stdlib logo abaixo:

```python
from datetime import date, timedelta
from decimal import Decimal

from tests.factories import AtendimentoFactory, PetFactory, ServicoFactory, TutorFactory
```

Depois, acrescentar as funções **ao fim** do arquivo (só funções, nenhum import):

```python
def _atendimento(pet, dias_atras, valor="50.00", status="Liberado"):
    return AtendimentoFactory(
        pet=pet,
        status=status,
        valor=Decimal(valor),
        data=date.today() - timedelta(days=dias_atras),
    )


def test_pet_vip_por_tres_visitas(api):
    pet = PetFactory()
    for dias in (1, 10, 20):
        _atendimento(pet, dias)

    dados = api.get(f"/api/pets/{pet.id}/").json()

    assert dados["vip"] is True
    assert dados["qtd_visitas"] == 3
    assert dados["total_gasto"] == "150.00"


def test_pet_vip_por_gasto(api):
    pet = PetFactory()
    _atendimento(pet, 5, valor="600.00")

    dados = api.get(f"/api/pets/{pet.id}/").json()

    assert dados["vip"] is True
    assert dados["qtd_visitas"] == 1


def test_pet_comum_nao_e_vip(api):
    pet = PetFactory()
    _atendimento(pet, 5, valor="100.00")

    assert api.get(f"/api/pets/{pet.id}/").json()["vip"] is False


def test_pet_sem_atendimento_aparece_na_lista(api):
    """Trava o INNER JOIN: sem agregação condicional, este pet sumiria."""
    PetFactory()

    lista = api.get("/api/pets/").json()

    assert lista["count"] == 1
    assert lista["results"][0]["vip"] is False
    assert lista["results"][0]["qtd_visitas"] == 0
    assert lista["results"][0]["total_gasto"] == "0.00"


def test_atendimento_antigo_nao_faz_vip(api):
    pet = PetFactory()
    _atendimento(pet, dias_atras=400, valor="900.00")

    assert api.get(f"/api/pets/{pet.id}/").json()["vip"] is False


def test_status_pendente_nao_faz_vip(api):
    pet = PetFactory()
    for dias in (1, 2, 3):
        _atendimento(pet, dias, status="Pendente")

    assert api.get(f"/api/pets/{pet.id}/").json()["vip"] is False


def test_post_de_pet_responde_vip_falso_sem_estourar(api):
    """O objeto do create não passa pelo get_queryset() anotado."""
    tutor = TutorFactory()

    resp = api.post("/api/pets/", {"tutor": tutor.id, "nome": "Rex", "porte": "M"})

    assert resp.status_code == 201
    assert resp.json()["vip"] is False
    assert resp.json()["qtd_visitas"] == 0
    assert resp.json()["total_gasto"] == "0.00"
```

E acrescentar ao fim de `backend/tests/test_dashboard.py`. O arquivo **já tem** a fixture `api` (linhas 21-26) e já importa `date`, `Decimal`, `AtendimentoFactory` e `PetFactory` no topo; reusar tudo, sem novos imports (imports duplicados disparam F811 no ruff):

```python
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
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_api_cadastros.py -v -k vip`
Expected: FAIL com `KeyError: 'vip'`

- [ ] **Step 3: Implementar**

Em `backend/core/serializers.py`, trocar o `PetSerializer` inteiro por:

```python
class PetSerializer(serializers.ModelSerializer):
    tutor_nome = serializers.CharField(source="tutor.nome", read_only=True)
    # SerializerMethodField (e não BooleanField/IntegerField) porque o objeto
    # devolvido pelo POST não passa pelo get_queryset() anotado do ViewSet.
    vip = serializers.SerializerMethodField()
    qtd_visitas = serializers.SerializerMethodField()
    total_gasto = serializers.SerializerMethodField()

    class Meta:
        model = models.Pet
        fields = [
            "id", "tutor", "tutor_nome", "nome", "raca", "porte", "ativo",
            "created_at", "vip", "qtd_visitas", "total_gasto",
        ]
        read_only_fields = ["ativo", "created_at"]

    def get_qtd_visitas(self, obj) -> int:
        return getattr(obj, "qtd_visitas", 0)

    def get_total_gasto(self, obj) -> str:
        total = getattr(obj, "total_gasto", None) or Decimal("0")
        return str(total.quantize(Decimal("0.01")))

    def get_vip(self, obj) -> bool:
        # Derivado, nunca armazenado (invariante 6). Vale tanto para o queryset
        # anotado pelo PetViewSet (janela de 365 dias) quanto para o do
        # dashboard (pets_vip, janela do período consultado).
        return (
            self.get_qtd_visitas(obj) >= services.VIP_MIN_VISITAS
            or Decimal(self.get_total_gasto(obj)) >= services.VIP_MIN_GASTO
        )
```

No topo de `backend/core/serializers.py`, garantir os imports:

```python
from decimal import Decimal

from rest_framework import serializers

from . import models, services
```

Em `backend/core/views.py`, trocar o `get_queryset` do `PetViewSet`:

```python
    def get_queryset(self):
        qs = models.Pet.objects.filter(ativo=True).select_related("tutor").order_by("nome")
        return services.anota_vip(qs, date.today())
```

- [ ] **Step 4: Rodar a suíte e ver passar**

Run: `./.venv/Scripts/python.exe -m pytest tests/ -v`
Expected: PASS, toda a suíte verde (nenhum teste antigo quebrado)

Run: `./.venv/Scripts/python.exe manage.py makemigrations --check --dry-run`
Expected: `No changes detected`

Run: `./.venv/Scripts/python.exe -m ruff check .`
Expected: `All checks passed!`

- [ ] **Step 5: Commit**

```bash
git add backend/core/serializers.py backend/core/views.py backend/tests/test_api_cadastros.py backend/tests/test_dashboard.py
git commit -m "feat: expose derived vip, qtd_visitas and total_gasto on PetSerializer"
```

---

### Task 3: `servico_nome` no `AtendimentoSerializer`

**Files:**
- Modify: `backend/core/serializers.py`
- Test: `backend/tests/test_api_atendimentos.py`

**Interfaces:**
- Produces: `GET /api/atendimentos/?pet=<id>` devolve `servico_nome: str` em cada item.

Sem esse campo, o histórico do pet precisaria de um segundo request só para traduzir ids. O `AtendimentoViewSet` já faz `select_related("servico")`, então não há N+1.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `backend/tests/test_api_atendimentos.py`:

```python
def test_historico_do_pet_traz_nome_do_servico(api):
    servico = ServicoFactory(nome="Banho e Tosa")
    pet = PetFactory()
    AtendimentoFactory(pet=pet, servico=servico, status="Liberado")

    resp = api.get(f"/api/atendimentos/?pet={pet.id}")

    assert resp.json()["results"][0]["servico_nome"] == "Banho e Tosa"
    assert resp.json()["results"][0]["pacote"] is None
```

Garantir que `ServicoFactory`, `PetFactory` e `AtendimentoFactory` estão importados no arquivo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_api_atendimentos.py::test_historico_do_pet_traz_nome_do_servico -v`
Expected: FAIL com `KeyError: 'servico_nome'`

- [ ] **Step 3: Implementar**

Em `backend/core/serializers.py`, no `AtendimentoSerializer`, acrescentar o campo e incluí-lo em `fields`:

```python
class AtendimentoSerializer(serializers.ModelSerializer):
    pagamentos = PagamentoSerializer(many=True, required=False)
    servico_nome = serializers.CharField(source="servico.nome", read_only=True)

    class Meta:
        model = models.Atendimento
        fields = [
            "id", "pet", "servico", "servico_nome", "pacote", "data", "horario",
            "valor", "transporte", "transporte_valor", "status", "pagamentos",
        ]
```

O resto da classe (`create`, `update`, `validate`) fica intacto.

- [ ] **Step 4: Rodar e ver passar**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_api_atendimentos.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/core/serializers.py backend/tests/test_api_atendimentos.py
git commit -m "feat: add servico_nome to AtendimentoSerializer"
```

---

### Task 4: Comando `seed_dev`

**Files:**
- Create: `backend/core/management/__init__.py`
- Create: `backend/core/management/commands/__init__.py`
- Create: `backend/core/management/commands/seed_dev.py`
- Test: `backend/tests/test_seed_dev.py` (criar)

**Interfaces:**
- Produces: `python manage.py seed_dev`, idempotente, guardado por `DEBUG`.

Escrito com ORM puro. `factory_boy` só existe em `requirements-dev.txt`; um comando de app importando de `tests/` acoplaria produção à suíte de testes.

Os dados cobrem os quatro casos que a UI precisa mostrar: um pet VIP por visitas, um VIP por gasto, um comum e um sem nenhum atendimento.

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/tests/test_seed_dev.py`:

```python
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_seed_dev.py -v`
Expected: FAIL com `CommandError: Unknown command: 'seed_dev'`

- [ ] **Step 3: Implementar**

Criar `backend/core/management/__init__.py` e `backend/core/management/commands/__init__.py`, ambos vazios.

Criar `backend/core/management/commands/seed_dev.py`:

```python
from datetime import date, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core.models import Atendimento, Pet, Servico, Tutor

TUTORES = [
    ("Ana Clara Souza", "71988880001", "ana@exemplo.com"),
    ("Rafael Lima", "71988880002", "rafael@exemplo.com"),
    ("Camila Duarte", "71988880003", ""),
    ("Bruno Teixeira", "71988880004", ""),
]

# (nome, indice do tutor, raça, porte)
PETS = [
    ("Luna", 0, "Shih Tzu", "P"),
    ("Thor", 0, "Golden Retriever", "G"),
    ("Mel", 1, "Poodle", "P"),
    ("Nina", 2, "SRD", "M"),
    ("Bob", 3, "Beagle", "M"),
    ("Pipoca", 3, "Lhasa Apso", "P"),
]

SERVICOS = [
    ("Banho", Decimal("60.00"), False, None),
    ("Banho e Tosa", Decimal("95.00"), False, None),
    ("Pacote Fidelidade", Decimal("220.00"), True, 4),
]


class Command(BaseCommand):
    help = "Popula o banco com dados fictícios para desenvolvimento local."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_dev só roda com DEBUG=True. Abortado.")

        hoje = date.today()

        servicos = {}
        for nome, preco, is_pacote, creditos in SERVICOS:
            servicos[nome], _ = Servico.objects.get_or_create(
                nome=nome,
                defaults={"preco_padrao": preco, "is_pacote": is_pacote, "creditos": creditos},
            )

        tutores = []
        for nome, telefone, email in TUTORES:
            tutor, _ = Tutor.objects.get_or_create(
                nome=nome, defaults={"telefone": telefone, "email": email}
            )
            tutores.append(tutor)

        pets = []
        for nome, indice, raca, porte in PETS:
            pet, _ = Pet.objects.get_or_create(
                nome=nome,
                tutor=tutores[indice],
                defaults={"raca": raca, "porte": porte},
            )
            pets.append(pet)

        # Luna (0): VIP por 3 banhos na janela. Mel (2): VIP por um atendimento
        # de R$600. Thor (1): comum. Nina (3): um atendimento de 400 dias atrás,
        # fora da janela de 365 -> não-VIP. Bob (4) e Pipoca (5): sem atendimento,
        # para provar na tela que pets sem histórico não somem da lista.
        agenda = [
            (pets[0], "Banho", 60, 7),
            (pets[0], "Banho", 60, 21),
            (pets[0], "Banho e Tosa", 95, 35),
            (pets[2], "Banho e Tosa", 600, 14),
            (pets[1], "Banho", 60, 10),
            (pets[3], "Banho", 60, 400),  # fora da janela de 365 dias
        ]
        # As datas são relativas a hoje, então a chave (pet, servico, data) muda
        # de um dia para o outro; um get_or_create criaria duplicatas a cada
        # rerun. Recriar do zero os atendimentos dos pets do seed mantém o
        # comando idempotente em qualquer dia (só roda com DEBUG).
        Atendimento.objects.filter(pet__in=pets).delete()
        for pet, servico, valor, dias_atras in agenda:
            Atendimento.objects.create(
                pet=pet,
                servico=servicos[servico],
                data=hoje - timedelta(days=dias_atras),
                horario=time(10, 0),
                valor=Decimal(valor),
                status=Atendimento.Status.LIBERADO,
            )

        # Contadores locais (o que o seed garante), não contagem global do banco:
        # a mensagem não muda se já houver outros dados no dev.
        self.stdout.write(
            self.style.SUCCESS(
                f"Seed pronto: {len(tutores)} tutores, {len(pets)} pets, "
                f"{len(agenda)} atendimentos."
            )
        )
```

- [ ] **Step 4: Rodar e ver passar**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_seed_dev.py -v`
Expected: PASS, 3 passed

Rodar de verdade no banco local:

Run: `./.venv/Scripts/python.exe manage.py seed_dev`
Expected: `Seed pronto: 4 tutores, 6 pets, 6 atendimentos.`

Run: `./.venv/Scripts/python.exe -m ruff check .`
Expected: `All checks passed!`

- [ ] **Step 5: Commit**

```bash
git add backend/core/management backend/tests/test_seed_dev.py
git commit -m "feat: add seed_dev management command guarded by DEBUG"
```

---

### Task 5: Quitar a dívida do PR 9 (`queryClient` e `Input`)

**Files:**
- Modify: `frontend/src/lib/queryClient.ts`
- Modify: `frontend/src/components/ui/Input.tsx`
- Test: `frontend/src/lib/queryClient.test.ts` (criar)
- Test: `frontend/src/components/ui/Input.test.tsx`

**Interfaces:**
- Produces: `Input` sempre associa `label` a `input` via `id`, mesmo sem `id` nem `name`. Um 401 em N queries paralelas dispara **um** `window.location.assign("/login")`.

`/clientes/:id` dispara tutor e pets em paralelo, então dois 401 no mesmo tick deixam de ser hipótese.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/lib/queryClient.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("aoFalharComo401", () => {
  it("redireciona uma única vez quando N queries falham com 401", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });

    const { queryClient } = await import("./queryClient");
    const { ApiError } = await import("./api");

    const erro = new ApiError(401, "Sessão expirada");
    const cache = queryClient.getQueryCache();
    cache.config.onError?.(erro, {} as never);
    cache.config.onError?.(erro, {} as never);
    cache.config.onError?.(erro, {} as never);

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("não redireciona em erro que não é 401", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });

    const { queryClient } = await import("./queryClient");
    const { ApiError } = await import("./api");

    queryClient.getQueryCache().config.onError?.(new ApiError(500, "boom"), {} as never);

    expect(assign).not.toHaveBeenCalled();
  });
});
```

Acrescentar a `frontend/src/components/ui/Input.test.tsx`:

```tsx
it("associa label e input mesmo sem id nem name", () => {
  render(<Input label="Raça" />);

  expect(screen.getByLabelText("Raça")).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run (a partir de `frontend/`): `npm run test -- src/lib/queryClient.test.ts src/components/ui/Input.test.tsx`
Expected: FAIL. O teste do `queryClient` falha com `expected 1, received 3`; o do `Input` falha com `Found a label with the text of: Raça, however no form element was found associated to that label`.

- [ ] **Step 3: Implementar**

Substituir `frontend/src/lib/queryClient.ts` por:

```ts
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import { clearTokens } from "./auth";

// N queries paralelas podem falhar com 401 no mesmo tick (o detalhe do tutor
// busca tutor e pets juntos). Sem esta flag, cada uma dispararia seu próprio
// redirect. Não é loop, mas empilha navegações.
let redirecionando = false;

function aoFalharComo401(error: unknown) {
  if (error instanceof ApiError && error.status === 401 && !redirecionando) {
    redirecionando = true;
    clearTokens();
    window.location.assign("/login");
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: aoFalharComo401 }),
  mutationCache: new MutationCache({ onError: aoFalharComo401 }),
  defaultOptions: {
    queries: {
      // Erro 4xx é determinístico (auth, validação, 404): repetir não ajuda.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
        failureCount < 2,
    },
  },
});
```

Substituir `frontend/src/components/ui/Input.tsx` por:

```tsx
import { useId, type ComponentPropsWithRef } from "react";

interface InputProps extends ComponentPropsWithRef<"input"> {
  label: string;
  error?: string;
}

export function Input({ label, error, id, className = "", ...props }: InputProps) {
  // O register() do react-hook-form sempre passa `name`, mas um campo via
  // Controller pode não passar. Sem o useId, label e input ficam órfãos.
  const gerado = useId();
  const inputId = id ?? props.name ?? gerado;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-escuro">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={`rounded-lg border bg-white px-3 py-2 text-sm text-escuro transition-colors outline-none placeholder:text-neutro focus:border-marsala focus:ring-2 focus:ring-marsala/20 ${
          error ? "border-erro" : "border-neutro-light"
        } ${className}`}
        {...props}
      />
      {error && (
        <p role="alert" className="text-xs text-erro">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test`
Expected: PASS, suíte inteira verde

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/queryClient.ts frontend/src/lib/queryClient.test.ts frontend/src/components/ui/Input.tsx frontend/src/components/ui/Input.test.tsx
git commit -m "fix: guard 401 redirect and fall back to useId in Input"
```

---

### Task 6: Tipos, helper de teste e hooks de dados

**Files:**
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/test/utils.tsx`
- Create: `frontend/src/hooks/useTutores.ts`
- Create: `frontend/src/hooks/usePets.ts`
- Create: `frontend/src/hooks/useAtendimentos.ts`
- Test: `frontend/src/hooks/useTutores.test.tsx` (criar)

**Interfaces:**
- Consumes: `request<T>` de `lib/api.ts`.
- Produces:
  - `Paginated<T> { count: number; next: string | null; previous: string | null; results: T[] }`
  - `Tutor`, `Pet`, `Atendimento`, `Pagamento`
  - `useTutores(busca: string, pagina: number)`, `useTutor(id: number)`, `useCriarTutor()`, `useAtualizarTutor(id: number)`, `useDesativarTutor()`
  - `usePetsDoTutor(tutorId: number)`, `usePet(id: number)`, `useCriarPet()`, `useAtualizarPet(id: number)`, `useDesativarPet()`
  - `useAtendimentosDoPet(petId: number, pagina: number)`
  - `renderizarComProvedores(ui, { rota })` de `test/utils.tsx`

- [ ] **Step 1: Escrever os tipos**

Criar `frontend/src/lib/types.ts`:

```ts
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Tutor {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  ativo: boolean;
  created_at: string;
}

export type Porte = "" | "P" | "M" | "G";

export interface Pet {
  id: number;
  tutor: number;
  tutor_nome: string;
  nome: string;
  raca: string;
  porte: Porte;
  ativo: boolean;
  created_at: string;
  vip: boolean;
  qtd_visitas: number;
  total_gasto: string;
}

export interface Pagamento {
  id: number;
  metodo: "Pix" | "Cartao" | "Dinheiro";
  valor: string;
}

export type StatusAtendimento = "Liberado" | "Pendente" | "Cancelado";

export interface Atendimento {
  id: number;
  pet: number;
  servico: number;
  servico_nome: string;
  /** Não-nulo significa consumo de crédito de pacote (invariante 2). */
  pacote: number | null;
  data: string;
  horario: string;
  valor: string;
  transporte: boolean;
  transporte_valor: string;
  status: StatusAtendimento;
  pagamentos: Pagamento[];
}

export const PORTES: { valor: Porte; rotulo: string }[] = [
  { valor: "", rotulo: "Não informado" },
  { valor: "P", rotulo: "Pequeno" },
  { valor: "M", rotulo: "Médio" },
  { valor: "G", rotulo: "Grande" },
];

export const TAMANHO_PAGINA = 50;
```

- [ ] **Step 2: Escrever o helper de teste**

Criar `frontend/src/test/utils.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/** Um client por teste, sem retry: um 404 esperado não deve demorar 3 tentativas. */
function novoQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export function renderizarComProvedores(
  ui: ReactElement,
  { rota = "/", caminho = "/" }: { rota?: string; caminho?: string } = {},
) {
  const client = novoQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path={caminho} element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(ui, { wrapper: Wrapper });
}
```

- [ ] **Step 3: Escrever o teste que falha**

Criar `frontend/src/hooks/useTutores.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { useTutores } from "./useTutores";

const BASE = "http://localhost:8000/api";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useTutores", () => {
  it("busca a lista paginada e envia search e page", async () => {
    let urlChamada = "";
    server.use(
      http.get(`${BASE}/tutores/`, ({ request }) => {
        urlChamada = request.url;
        return HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [
            { id: 1, nome: "Ana", telefone: "71", email: "", ativo: true, created_at: "2026-07-01" },
          ],
        });
      }),
    );

    const { result } = renderHook(() => useTutores("Ana", 2), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.results[0].nome).toBe("Ana");
    expect(urlChamada).toContain("search=Ana");
    expect(urlChamada).toContain("page=2");
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm run test -- src/hooks/useTutores.test.tsx`
Expected: FAIL com `Failed to resolve import "./useTutores"`

- [ ] **Step 5: Implementar os hooks**

Criar `frontend/src/hooks/useTutores.ts`:

```ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Paginated, Tutor } from "../lib/types";

export type TutorEntrada = Pick<Tutor, "nome" | "telefone" | "email">;

export const chavesTutores = {
  raiz: ["tutores"] as const,
  lista: (busca: string, pagina: number) => ["tutores", "lista", busca, pagina] as const,
  detalhe: (id: number) => ["tutores", "detalhe", id] as const,
};

export function useTutores(busca: string, pagina: number) {
  const params = new URLSearchParams({ page: String(pagina) });
  if (busca) params.set("search", busca);
  return useQuery({
    queryKey: chavesTutores.lista(busca, pagina),
    queryFn: () => request<Paginated<Tutor>>(`/tutores/?${params}`),
    // Sem isto a lista pisca em branco a cada tecla digitada na busca.
    placeholderData: keepPreviousData,
  });
}

export function useTutor(id: number) {
  return useQuery({
    queryKey: chavesTutores.detalhe(id),
    queryFn: () => request<Tutor>(`/tutores/${id}/`),
  });
}

export function useCriarTutor() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: TutorEntrada) =>
      request<Tutor>("/tutores/", { method: "POST", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesTutores.raiz }),
  });
}

export function useAtualizarTutor(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: TutorEntrada) =>
      request<Tutor>(`/tutores/${id}/`, { method: "PATCH", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesTutores.raiz }),
  });
}

/** DELETE no backend é soft-delete (ativo = False); o histórico financeiro fica. */
export function useDesativarTutor() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request<null>(`/tutores/${id}/`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesTutores.raiz }),
  });
}
```

Criar `frontend/src/hooks/usePets.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Paginated, Pet, Porte } from "../lib/types";

export interface PetEntrada {
  tutor: number;
  nome: string;
  raca: string;
  porte: Porte;
}

export const chavesPets = {
  raiz: ["pets"] as const,
  doTutor: (tutorId: number) => ["pets", "doTutor", tutorId] as const,
  detalhe: (id: number) => ["pets", "detalhe", id] as const,
};

export function usePetsDoTutor(tutorId: number) {
  return useQuery({
    queryKey: chavesPets.doTutor(tutorId),
    queryFn: () => request<Paginated<Pet>>(`/pets/?tutor=${tutorId}`),
  });
}

export function usePet(id: number) {
  return useQuery({
    queryKey: chavesPets.detalhe(id),
    queryFn: () => request<Pet>(`/pets/${id}/`),
  });
}

export function useCriarPet() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: PetEntrada) =>
      request<Pet>("/pets/", { method: "POST", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesPets.raiz }),
  });
}

export function useAtualizarPet(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: PetEntrada) =>
      request<Pet>(`/pets/${id}/`, { method: "PATCH", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesPets.raiz }),
  });
}

export function useDesativarPet() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request<null>(`/pets/${id}/`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesPets.raiz }),
  });
}
```

Criar `frontend/src/hooks/useAtendimentos.ts`:

```ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Atendimento, Paginated } from "../lib/types";

export const chavesAtendimentos = {
  raiz: ["atendimentos"] as const,
  doPet: (petId: number, pagina: number) => ["atendimentos", "doPet", petId, pagina] as const,
};

export function useAtendimentosDoPet(petId: number, pagina: number) {
  return useQuery({
    queryKey: chavesAtendimentos.doPet(petId, pagina),
    queryFn: () =>
      request<Paginated<Atendimento>>(`/atendimentos/?pet=${petId}&page=${pagina}`),
    placeholderData: keepPreviousData,
  });
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm run test -- src/hooks/useTutores.test.tsx`
Expected: PASS

Run: `npm run build`
Expected: build sem erro de tipo

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/test/utils.tsx frontend/src/hooks
git commit -m "feat: add domain types and TanStack Query hooks for tutores, pets and atendimentos"
```

---

### Task 7: `Modal` (Radix Dialog) e `Select` (nativo)

**Files:**
- Create: `frontend/src/components/ui/Modal.tsx`
- Create: `frontend/src/components/ui/Select.tsx`
- Test: `frontend/src/components/ui/Modal.test.tsx` (criar)
- Test: `frontend/src/components/ui/Select.test.tsx` (criar)
- Modify: `frontend/package.json` (dependência `@radix-ui/react-dialog`)

**Interfaces:**
- Produces: `<Modal aberto titulo aoFechar>{children}</Modal>`, `<Select label error>{options}</Select>`.

O PR 9 decidiu "Radix pontual quando a a11y for complexa (Dialog, Select)". Aqui o Dialog leva Radix (focus trap, `Esc`, portal, scroll lock, `aria-modal`); o Select **não**, porque `<select>` nativo já é acessível e o Radix Select resolveria estética, não acessibilidade.

- [ ] **Step 1: Instalar a dependência**

```bash
cd frontend
npm install @radix-ui/react-dialog
```

- [ ] **Step 2: Escrever os testes que falham**

Criar `frontend/src/components/ui/Modal.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("não renderiza o conteúdo quando fechado", () => {
    render(
      <Modal aberto={false} titulo="Novo tutor" aoFechar={() => {}}>
        <p>conteúdo</p>
      </Modal>,
    );

    expect(screen.queryByText("conteúdo")).not.toBeInTheDocument();
  });

  it("renderiza como dialog com título acessível quando aberto", () => {
    render(
      <Modal aberto titulo="Novo tutor" aoFechar={() => {}}>
        <p>conteúdo</p>
      </Modal>,
    );

    expect(screen.getByRole("dialog", { name: "Novo tutor" })).toBeInTheDocument();
  });

  it("chama aoFechar ao apertar Esc", async () => {
    const aoFechar = vi.fn();
    render(
      <Modal aberto titulo="Novo tutor" aoFechar={aoFechar}>
        <p>conteúdo</p>
      </Modal>,
    );

    await userEvent.keyboard("{Escape}");

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
```

Criar `frontend/src/components/ui/Select.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Select } from "./Select";

describe("Select", () => {
  it("associa o label ao select e permite escolher uma opção", async () => {
    render(
      <Select label="Porte" defaultValue="">
        <option value="">Não informado</option>
        <option value="M">Médio</option>
      </Select>,
    );

    const campo = screen.getByLabelText("Porte");
    await userEvent.selectOptions(campo, "M");

    expect(campo).toHaveValue("M");
  });

  it("mostra a mensagem de erro com role alert", () => {
    render(
      <Select label="Porte" error="Escolha um porte">
        <option value="">Não informado</option>
      </Select>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Escolha um porte");
    expect(screen.getByLabelText("Porte")).toHaveAttribute("aria-invalid", "true");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm run test -- src/components/ui/Modal.test.tsx src/components/ui/Select.test.tsx`
Expected: FAIL com `Failed to resolve import "./Modal"`

- [ ] **Step 4: Implementar**

Criar `frontend/src/components/ui/Modal.tsx`:

```tsx
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  aberto: boolean;
  titulo: string;
  /** Chamado no Esc, no clique no backdrop e no botão de fechar. */
  aoFechar: () => void;
  children: ReactNode;
}

export function Modal({ aberto, titulo, aoFechar, children }: ModalProps) {
  return (
    <Dialog.Root open={aberto} onOpenChange={(estaAberto) => !estaAberto && aoFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-escuro/50" />
        {/* aria-describedby={undefined}: o título já descreve o diálogo. É o
            idiom do Radix para dispensar o Description sem o aviso de console. */}
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-neutro-light/60 bg-creme p-6 shadow-lg"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="font-display text-xl text-escuro">{titulo}</Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded-lg p-1 text-neutro transition-colors hover:bg-neutro-light/40 hover:text-escuro"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Criar `frontend/src/components/ui/Select.tsx`:

```tsx
import { useId, type ComponentPropsWithRef } from "react";

interface SelectProps extends ComponentPropsWithRef<"select"> {
  label: string;
  error?: string;
}

export function Select({ label, error, id, className = "", ...props }: SelectProps) {
  const gerado = useId();
  const selectId = id ?? props.name ?? gerado;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-escuro">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={`rounded-lg border bg-white px-3 py-2 text-sm text-escuro transition-colors outline-none focus:border-marsala focus:ring-2 focus:ring-marsala/20 ${
          error ? "border-erro" : "border-neutro-light"
        } ${className}`}
        {...props}
      />
      {error && (
        <p role="alert" className="text-xs text-erro">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm run test -- src/components/ui/Modal.test.tsx src/components/ui/Select.test.tsx`
Expected: PASS, 5 passed

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/ui/Modal.tsx frontend/src/components/ui/Modal.test.tsx frontend/src/components/ui/Select.tsx frontend/src/components/ui/Select.test.tsx
git commit -m "feat: add Modal on Radix Dialog and native Select primitives"
```

---

### Task 8: `Paginacao`, `EstadoVazio` e `ErroAoCarregar`

**Files:**
- Create: `frontend/src/components/ui/Paginacao.tsx`
- Create: `frontend/src/components/EstadoVazio.tsx`
- Create: `frontend/src/components/ErroAoCarregar.tsx`
- Test: `frontend/src/components/ui/Paginacao.test.tsx` (criar)

**Interfaces:**
- Produces: `<Paginacao pagina count aoMudar />`, `<EstadoVazio titulo descricao acao? />`, `<ErroAoCarregar aoTentarDeNovo />`.

Sem `Paginacao`, um pet com dois anos de banho semanal mostraria só os 50 atendimentos mais recentes **sem avisar**. Truncar em silêncio é o pior tipo de bug.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/components/ui/Paginacao.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Paginacao } from "./Paginacao";

describe("Paginacao", () => {
  it("não renderiza nada quando cabe em uma página", () => {
    const { container } = render(<Paginacao pagina={1} count={12} aoMudar={() => {}} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("mostra a página atual e o total", () => {
    render(<Paginacao pagina={2} count={120} aoMudar={() => {}} />);

    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
  });

  it("desabilita Anterior na primeira e Próxima na última", () => {
    const { rerender } = render(<Paginacao pagina={1} count={120} aoMudar={() => {}} />);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    rerender(<Paginacao pagina={3} count={120} aoMudar={() => {}} />);
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });

  it("avança de página", async () => {
    const aoMudar = vi.fn();
    render(<Paginacao pagina={1} count={120} aoMudar={aoMudar} />);

    await userEvent.click(screen.getByRole("button", { name: "Próxima" }));

    expect(aoMudar).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- src/components/ui/Paginacao.test.tsx`
Expected: FAIL com `Failed to resolve import "./Paginacao"`

- [ ] **Step 3: Implementar**

Criar `frontend/src/components/ui/Paginacao.tsx`:

```tsx
import { TAMANHO_PAGINA } from "../../lib/types";
import { Button } from "./Button";

interface PaginacaoProps {
  pagina: number;
  /** Total de itens, vindo do `count` do DRF. */
  count: number;
  aoMudar: (pagina: number) => void;
  porPagina?: number;
}

export function Paginacao({ pagina, count, aoMudar, porPagina = TAMANHO_PAGINA }: PaginacaoProps) {
  const totalPaginas = Math.ceil(count / porPagina);
  if (totalPaginas <= 1) return null;

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-4 pt-4">
      <Button variant="ghost" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
        Anterior
      </Button>
      <span className="font-mono text-xs text-neutro">
        Página {pagina} de {totalPaginas}
      </span>
      <Button
        variant="ghost"
        disabled={pagina >= totalPaginas}
        onClick={() => aoMudar(pagina + 1)}
      >
        Próxima
      </Button>
    </nav>
  );
}
```

Criar `frontend/src/components/EstadoVazio.tsx`:

```tsx
import type { ReactNode } from "react";
import { Card } from "./ui/Card";

interface EstadoVazioProps {
  titulo: string;
  descricao: string;
  acao?: ReactNode;
}

export function EstadoVazio({ titulo, descricao, acao }: EstadoVazioProps) {
  return (
    <Card className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="text-lg font-medium text-escuro">{titulo}</p>
      <p className="text-sm text-neutro">{descricao}</p>
      {acao && <div className="mt-4">{acao}</div>}
    </Card>
  );
}
```

Criar `frontend/src/components/ErroAoCarregar.tsx`:

```tsx
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

interface ErroAoCarregarProps {
  mensagem?: string;
  aoTentarDeNovo: () => void;
}

export function ErroAoCarregar({
  mensagem = "Não foi possível carregar os dados.",
  aoTentarDeNovo,
}: ErroAoCarregarProps) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <p role="alert" className="text-sm text-erro">
        {mensagem}
      </p>
      <Button variant="secondary" onClick={aoTentarDeNovo}>
        Tentar de novo
      </Button>
    </Card>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test -- src/components/ui/Paginacao.test.tsx`
Expected: PASS, 4 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/Paginacao.tsx frontend/src/components/ui/Paginacao.test.tsx frontend/src/components/EstadoVazio.tsx frontend/src/components/ErroAoCarregar.tsx
git commit -m "feat: add Paginacao, EstadoVazio and ErroAoCarregar components"
```

---

### Task 9: `TutorForm` e `PetForm`

**Files:**
- Create: `frontend/src/components/clientes/TutorForm.tsx`
- Create: `frontend/src/components/clientes/PetForm.tsx`
- Test: `frontend/src/components/clientes/TutorForm.test.tsx` (criar)

**Interfaces:**
- Consumes: `Input`, `Select`, `Button`, `TutorEntrada`, `PetEntrada`, `PORTES`.
- Produces: `<TutorForm inicial? aoSalvar enviando aoCancelar />`, `<PetForm tutorId inicial? aoSalvar enviando aoCancelar />`. Ambos são **controlados por quem chama**: não conhecem mutation nem modal, só recebem `aoSalvar(dados)`.

Os formulários não falam com a API. Quem monta a mutation é a página. Isso mantém os dois testáveis sem MSW.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/components/clientes/TutorForm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TutorForm } from "./TutorForm";

describe("TutorForm", () => {
  it("exige nome e telefone", async () => {
    const aoSalvar = vi.fn();
    render(<TutorForm aoSalvar={aoSalvar} enviando={false} aoCancelar={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Informe o nome")).toBeInTheDocument();
    expect(screen.getByText("Informe o telefone")).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it("envia os dados preenchidos", async () => {
    const aoSalvar = vi.fn();
    render(<TutorForm aoSalvar={aoSalvar} enviando={false} aoCancelar={() => {}} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Ana Clara");
    await userEvent.type(screen.getByLabelText("Telefone"), "71988880001");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(aoSalvar).toHaveBeenCalledWith({
      nome: "Ana Clara",
      telefone: "71988880001",
      email: "",
    });
  });

  it("pré-preenche ao editar", () => {
    render(
      <TutorForm
        inicial={{ nome: "Rafael", telefone: "71", email: "r@x.com" }}
        aoSalvar={vi.fn()}
        enviando={false}
        aoCancelar={() => {}}
      />,
    );

    expect(screen.getByLabelText("Nome")).toHaveValue("Rafael");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- src/components/clientes/TutorForm.test.tsx`
Expected: FAIL com `Failed to resolve import "./TutorForm"`

- [ ] **Step 3: Implementar**

Criar `frontend/src/components/clientes/TutorForm.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { TutorEntrada } from "../../hooks/useTutores";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

const schema = z.object({
  nome: z.string().min(1, "Informe o nome"),
  telefone: z.string().min(1, "Informe o telefone"),
  email: z.union([z.literal(""), z.email("E-mail inválido")]),
});

type FormData = z.infer<typeof schema>;

interface TutorFormProps {
  inicial?: TutorEntrada;
  aoSalvar: (dados: TutorEntrada) => void;
  enviando: boolean;
  aoCancelar: () => void;
}

export function TutorForm({ inicial, aoSalvar, enviando, aoCancelar }: TutorFormProps) {
  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: inicial ?? { nome: "", telefone: "", email: "" },
  });

  return (
    <form onSubmit={handleSubmit(aoSalvar)} className="flex flex-col gap-4" noValidate>
      <Input label="Nome" error={formState.errors.nome?.message} {...register("nome")} />
      <Input
        label="Telefone"
        inputMode="tel"
        error={formState.errors.telefone?.message}
        {...register("telefone")}
      />
      <Input
        label="E-mail"
        type="email"
        error={formState.errors.email?.message}
        {...register("email")}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
```

Criar `frontend/src/components/clientes/PetForm.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { PetEntrada } from "../../hooks/usePets";
import { PORTES } from "../../lib/types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const schema = z.object({
  nome: z.string().min(1, "Informe o nome"),
  raca: z.string(),
  porte: z.enum(["", "P", "M", "G"]),
});

type FormData = z.infer<typeof schema>;

interface PetFormProps {
  tutorId: number;
  inicial?: Omit<PetEntrada, "tutor">;
  aoSalvar: (dados: PetEntrada) => void;
  enviando: boolean;
  aoCancelar: () => void;
}

export function PetForm({ tutorId, inicial, aoSalvar, enviando, aoCancelar }: PetFormProps) {
  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: inicial ?? { nome: "", raca: "", porte: "" },
  });

  return (
    <form
      onSubmit={handleSubmit((dados) => aoSalvar({ ...dados, tutor: tutorId }))}
      className="flex flex-col gap-4"
      noValidate
    >
      <Input label="Nome" error={formState.errors.nome?.message} {...register("nome")} />
      <Input label="Raça" error={formState.errors.raca?.message} {...register("raca")} />
      <Select label="Porte" error={formState.errors.porte?.message} {...register("porte")}>
        {PORTES.map((p) => (
          <option key={p.valor} value={p.valor}>
            {p.rotulo}
          </option>
        ))}
      </Select>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test -- src/components/clientes/TutorForm.test.tsx`
Expected: PASS, 3 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/clientes
git commit -m "feat: add TutorForm and PetForm controlled forms"
```

---

### Task 10: Página `Clientes` (lista, busca, paginação, criar tutor)

**Files:**
- Modify: `frontend/src/pages/Clientes.tsx`
- Test: `frontend/src/pages/Clientes.test.tsx` (criar)

**Interfaces:**
- Consumes: `useTutores`, `useCriarTutor`, `Modal`, `TutorForm`, `Paginacao`, `EstadoVazio`, `ErroAoCarregar`, `renderizarComProvedores`.
- Produces: rota `/clientes` funcional; cada linha da tabela leva a `/clientes/:id`.

Visual portado do protótipo: container `rounded-2xl border`, cabeçalho em caixa alta com tracking largo, tile quadrado com a inicial, `hover:bg-creme/50` na linha.

A busca usa um `useState` mais `setTimeout` de 300ms. Sem debounce, cada tecla vira um request; com `keepPreviousData`, a lista não pisca entre eles.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/pages/Clientes.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { renderizarComProvedores } from "../test/utils";
import { server } from "../test/msw/server";
import { Clientes } from "./Clientes";

const BASE = "http://localhost:8000/api";

function tutor(id: number, nome: string) {
  return { id, nome, telefone: "71988880001", email: "", ativo: true, created_at: "2026-07-01" };
}

function paginado(results: unknown[], count = results.length) {
  return { count, next: null, previous: null, results };
}

describe("Clientes", () => {
  it("lista os tutores vindos da API", async () => {
    server.use(http.get(`${BASE}/tutores/`, () => HttpResponse.json(paginado([tutor(1, "Ana Clara")]))));

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });

    expect(await screen.findByText("Ana Clara")).toBeInTheDocument();
  });

  it("mostra o estado vazio quando não há tutores", async () => {
    server.use(http.get(`${BASE}/tutores/`, () => HttpResponse.json(paginado([]))));

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });

    expect(await screen.findByText("Nenhum cliente ainda")).toBeInTheDocument();
  });

  it("mostra o erro e permite tentar de novo", async () => {
    server.use(http.get(`${BASE}/tutores/`, () => new HttpResponse(null, { status: 500 })));

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
  });

  it("envia o termo de busca para a API", async () => {
    const buscas: string[] = [];
    server.use(
      http.get(`${BASE}/tutores/`, ({ request }) => {
        buscas.push(new URL(request.url).searchParams.get("search") ?? "");
        return HttpResponse.json(paginado([tutor(1, "Ana Clara")]));
      }),
    );

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });
    await screen.findByText("Ana Clara");

    await userEvent.type(screen.getByLabelText("Buscar por nome ou telefone"), "Ana");

    await waitFor(() => expect(buscas).toContain("Ana"));
  });

  it("cria um tutor pelo modal e fecha", async () => {
    let criados = 0;
    server.use(
      http.get(`${BASE}/tutores/`, () => HttpResponse.json(paginado([]))),
      http.post(`${BASE}/tutores/`, async () => {
        criados += 1;
        return HttpResponse.json(tutor(9, "Bruno"), { status: 201 });
      }),
    );

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });
    // Lista vazia sem busca mostra "Novo tutor" no cabeçalho E no EstadoVazio.
    // Esperar o empty renderizar e clicar no primeiro (o do cabeçalho).
    await screen.findByText("Nenhum cliente ainda");
    await userEvent.click(screen.getAllByRole("button", { name: "Novo tutor" })[0]);

    await userEvent.type(screen.getByLabelText("Nome"), "Bruno");
    await userEvent.type(screen.getByLabelText("Telefone"), "71988880004");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(criados).toBe(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- src/pages/Clientes.test.tsx`
Expected: FAIL. O primeiro teste falha com `Unable to find an element with the text: Ana Clara` (a página ainda renderiza `<EmConstrucao />`).

- [ ] **Step 3: Implementar**

Substituir `frontend/src/pages/Clientes.tsx` por:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { EstadoVazio } from "../components/EstadoVazio";
import { TutorForm } from "../components/clientes/TutorForm";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Paginacao } from "../components/ui/Paginacao";
import { useCriarTutor, useTutores } from "../hooks/useTutores";

export function Clientes() {
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);

  // Debounce: sem isto, cada tecla vira um request. keepPreviousData segura a
  // lista anterior na tela enquanto o novo termo carrega.
  useEffect(() => {
    const id = setTimeout(() => {
      setBusca(texto);
      setPagina(1);
    }, 300);
    return () => clearTimeout(id);
  }, [texto]);

  const { data, isPending, isError, refetch } = useTutores(busca, pagina);
  const criar = useCriarTutor();

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Clientes</h1>
        <Button onClick={() => setModalAberto(true)}>Novo tutor</Button>
      </div>

      <div className="mt-6 max-w-sm">
        <Input
          label="Buscar por nome ou telefone"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ana, 71988..."
        />
      </div>

      <div className="mt-6">
        {isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => refetch()} />
        ) : isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : data.count === 0 ? (
          <EstadoVazio
            titulo={busca ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
            descricao={
              busca
                ? "Tente outro nome ou telefone."
                : "Cadastre o primeiro tutor para começar."
            }
            acao={
              busca ? undefined : <Button onClick={() => setModalAberto(true)}>Novo tutor</Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
                    <th className="px-6 py-3 font-semibold">Tutor</th>
                    <th className="px-2 py-3 font-semibold">Telefone</th>
                    <th className="px-6 py-3 font-semibold">E-mail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((tutor) => (
                    <tr
                      key={tutor.id}
                      className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50"
                    >
                      <td className="px-6 py-4">
                        <Link to={`/clientes/${tutor.id}`} className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-marsala font-semibold text-creme">
                            {tutor.nome.charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium text-escuro">{tutor.nome}</span>
                        </Link>
                      </td>
                      <td className="px-2 py-4 font-mono text-neutro">{tutor.telefone}</td>
                      <td className="px-6 py-4 text-neutro">{tutor.email || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} count={data.count} aoMudar={setPagina} />
          </>
        )}
      </div>

      <Modal aberto={modalAberto} titulo="Novo tutor" aoFechar={() => setModalAberto(false)}>
        <TutorForm
          enviando={criar.isPending}
          aoCancelar={() => setModalAberto(false)}
          aoSalvar={(dados) =>
            criar.mutate(dados, { onSuccess: () => setModalAberto(false) })
          }
        />
      </Modal>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test -- src/pages/Clientes.test.tsx`
Expected: PASS, 5 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Clientes.tsx frontend/src/pages/Clientes.test.tsx
git commit -m "feat: build Clientes list page with search, pagination and create modal"
```

---

### Task 11: Página `TutorDetalhe` e `PetCard`

**Files:**
- Create: `frontend/src/pages/TutorDetalhe.tsx`
- Create: `frontend/src/components/clientes/PetCard.tsx`
- Modify: `frontend/src/routes/router.tsx`
- Test: `frontend/src/pages/TutorDetalhe.test.tsx` (criar)

**Interfaces:**
- Consumes: `useTutor`, `useAtualizarTutor`, `useDesativarTutor`, `usePetsDoTutor`, `useCriarPet`, `Modal`, `TutorForm`, `PetForm`.
- Produces: rota `/clientes/:id`; `<PetCard pet />` linka para `/pets/:id` e mostra `Badge variant="vip"` quando `pet.vip`.

Desativar pede confirmação via `window.confirm`. É single-user, e um segundo modal aninhado dentro do Radix Dialog não paga o custo.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/pages/TutorDetalhe.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderizarComProvedores } from "../test/utils";
import { server } from "../test/msw/server";
import { TutorDetalhe } from "./TutorDetalhe";

const BASE = "http://localhost:8000/api";

const TUTOR = { id: 1, nome: "Ana Clara", telefone: "71988880001", email: "", ativo: true, created_at: "2026-07-01" };

function pet(id: number, nome: string, vip: boolean) {
  return {
    id, tutor: 1, tutor_nome: "Ana Clara", nome, raca: "SRD", porte: "M",
    ativo: true, created_at: "2026-07-01", vip, qtd_visitas: vip ? 3 : 0, total_gasto: "0.00",
  };
}

function montar() {
  return renderizarComProvedores(<TutorDetalhe />, {
    rota: "/clientes/1",
    caminho: "/clientes/:id",
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("TutorDetalhe", () => {
  it("mostra o tutor e seus pets, com badge VIP só em quem é VIP", async () => {
    server.use(
      http.get(`${BASE}/tutores/1/`, () => HttpResponse.json(TUTOR)),
      http.get(`${BASE}/pets/`, () =>
        HttpResponse.json({
          count: 2, next: null, previous: null,
          results: [pet(7, "Luna", true), pet(8, "Thor", false)],
        }),
      ),
    );

    montar();

    expect(await screen.findByRole("heading", { name: "Ana Clara" })).toBeInTheDocument();
    expect(screen.getByText("Luna")).toBeInTheDocument();
    expect(screen.getAllByText("VIP")).toHaveLength(1);
  });

  it("mostra estado vazio quando o tutor não tem pets", async () => {
    server.use(
      http.get(`${BASE}/tutores/1/`, () => HttpResponse.json(TUTOR)),
      http.get(`${BASE}/pets/`, () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
    );

    montar();

    expect(await screen.findByText("Nenhum pet cadastrado")).toBeInTheDocument();
  });

  it("desativa o tutor após confirmar", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    let deletado = false;
    server.use(
      http.get(`${BASE}/tutores/1/`, () => HttpResponse.json(TUTOR)),
      http.get(`${BASE}/pets/`, () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
      http.delete(`${BASE}/tutores/1/`, () => {
        deletado = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    montar();
    await userEvent.click(await screen.findByRole("button", { name: "Desativar" }));

    await waitFor(() => expect(deletado).toBe(true));
  });

  it("não desativa se o usuário cancelar a confirmação", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    let deletado = false;
    server.use(
      http.get(`${BASE}/tutores/1/`, () => HttpResponse.json(TUTOR)),
      http.get(`${BASE}/pets/`, () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
      http.delete(`${BASE}/tutores/1/`, () => {
        deletado = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    montar();
    await userEvent.click(await screen.findByRole("button", { name: "Desativar" }));

    expect(deletado).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- src/pages/TutorDetalhe.test.tsx`
Expected: FAIL com `Failed to resolve import "./TutorDetalhe"`

- [ ] **Step 3: Implementar**

Criar `frontend/src/components/clientes/PetCard.tsx`:

```tsx
import { Link } from "react-router-dom";
import type { Pet } from "../../lib/types";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

const ROTULOS_PORTE: Record<Pet["porte"], string> = {
  "": "Porte não informado",
  P: "Pequeno",
  M: "Médio",
  G: "Grande",
};

export function PetCard({ pet }: { pet: Pet }) {
  return (
    <Link to={`/pets/${pet.id}`} className="block">
      <Card className="transition-colors hover:border-ouro/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-escuro">{pet.nome}</p>
            <p className="text-xs text-neutro">
              {pet.raca || "Sem raça definida"} · {ROTULOS_PORTE[pet.porte]}
            </p>
          </div>
          {pet.vip && <Badge variant="vip">VIP</Badge>}
        </div>
      </Card>
    </Link>
  );
}
```

Criar `frontend/src/pages/TutorDetalhe.tsx`:

```tsx
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { EstadoVazio } from "../components/EstadoVazio";
import { PetCard } from "../components/clientes/PetCard";
import { PetForm } from "../components/clientes/PetForm";
import { TutorForm } from "../components/clientes/TutorForm";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useCriarPet, usePetsDoTutor } from "../hooks/usePets";
import { useAtualizarTutor, useDesativarTutor, useTutor } from "../hooks/useTutores";

export function TutorDetalhe() {
  const { id } = useParams();
  const tutorId = Number(id);
  const navigate = useNavigate();
  const [editando, setEditando] = useState(false);
  const [novoPet, setNovoPet] = useState(false);

  const tutor = useTutor(tutorId);
  const pets = usePetsDoTutor(tutorId);
  const atualizar = useAtualizarTutor(tutorId);
  const desativar = useDesativarTutor();
  const criarPet = useCriarPet();

  if (tutor.isError) return <ErroAoCarregar aoTentarDeNovo={() => tutor.refetch()} />;
  if (tutor.isPending) return <p className="text-sm text-neutro">Carregando...</p>;

  function aoDesativar() {
    if (!window.confirm("Desativar este tutor? Ele sai das listas, mas o histórico fica.")) return;
    desativar.mutate(tutorId, { onSuccess: () => navigate("/clientes") });
  }

  return (
    <div>
      <nav className="text-xs text-neutro">
        <Link to="/clientes" className="hover:text-marsala">
          Clientes
        </Link>{" "}
        / {tutor.data.nome}
      </nav>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-escuro">{tutor.data.nome}</h1>
          <p className="mt-1 text-sm text-neutro">
            <span className="font-mono">{tutor.data.telefone}</span>
            {tutor.data.email && ` · ${tutor.data.email}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditando(true)}>
            Editar
          </Button>
          <Button variant="danger" onClick={aoDesativar} disabled={desativar.isPending}>
            Desativar
          </Button>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between gap-4">
        <h2 className="font-display text-xl text-escuro">Pets</h2>
        <Button onClick={() => setNovoPet(true)}>Novo pet</Button>
      </div>

      <div className="mt-4">
        {pets.isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => pets.refetch()} />
        ) : pets.isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : pets.data.count === 0 ? (
          <EstadoVazio
            titulo="Nenhum pet cadastrado"
            descricao="Cadastre o primeiro pet deste tutor."
            acao={<Button onClick={() => setNovoPet(true)}>Novo pet</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pets.data.results.map((pet) => (
              <PetCard key={pet.id} pet={pet} />
            ))}
          </div>
        )}
      </div>

      <Modal aberto={editando} titulo="Editar tutor" aoFechar={() => setEditando(false)}>
        <TutorForm
          inicial={{
            nome: tutor.data.nome,
            telefone: tutor.data.telefone,
            email: tutor.data.email,
          }}
          enviando={atualizar.isPending}
          aoCancelar={() => setEditando(false)}
          aoSalvar={(dados) => atualizar.mutate(dados, { onSuccess: () => setEditando(false) })}
        />
      </Modal>

      <Modal aberto={novoPet} titulo="Novo pet" aoFechar={() => setNovoPet(false)}>
        <PetForm
          tutorId={tutorId}
          enviando={criarPet.isPending}
          aoCancelar={() => setNovoPet(false)}
          aoSalvar={(dados) => criarPet.mutate(dados, { onSuccess: () => setNovoPet(false) })}
        />
      </Modal>
    </div>
  );
}
```

Em `frontend/src/routes/router.tsx`, acrescentar o import e a rota:

```tsx
import { TutorDetalhe } from "../pages/TutorDetalhe";
```

e, dentro do array `children` do `AppShell`, logo abaixo de `{ path: "/clientes", element: <Clientes /> }`:

```tsx
          { path: "/clientes/:id", element: <TutorDetalhe /> },
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test -- src/pages/TutorDetalhe.test.tsx`
Expected: PASS, 4 passed

Run: `npm run build`
Expected: build sem erro de tipo

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TutorDetalhe.tsx frontend/src/pages/TutorDetalhe.test.tsx frontend/src/components/clientes/PetCard.tsx frontend/src/routes/router.tsx
git commit -m "feat: build TutorDetalhe page with pet cards and soft delete"
```

---

### Task 12: Página `PetDetalhe` e `HistoricoTabela`

**Files:**
- Create: `frontend/src/pages/PetDetalhe.tsx`
- Create: `frontend/src/components/clientes/HistoricoTabela.tsx`
- Modify: `frontend/src/routes/router.tsx`
- Test: `frontend/src/pages/PetDetalhe.test.tsx` (criar)
- Test: `frontend/src/components/clientes/HistoricoTabela.test.tsx` (criar)

**Interfaces:**
- Consumes: `usePet`, `useAtualizarPet`, `useDesativarPet`, `useAtendimentosDoPet`, `Paginacao`, `Badge`.
- Produces: rota `/pets/:id`.

O histórico marca o consumo de pacote pelo `pacote != null`, **nunca** por valor zero: o `valor` de um banho de pacote guarda o preço de referência e não entra no faturamento por causa do vínculo (invariantes 1 e 2). A coluna Valor mostra o número de qualquer jeito, e o badge "Pacote" explica por que ele não é receita nova.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/components/clientes/HistoricoTabela.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Atendimento } from "../../lib/types";
import { HistoricoTabela } from "./HistoricoTabela";

function atendimento(over: Partial<Atendimento>): Atendimento {
  return {
    id: 1, pet: 7, servico: 1, servico_nome: "Banho", pacote: null,
    data: "2026-07-01", horario: "10:00:00", valor: "95.00",
    transporte: false, transporte_valor: "0.00", status: "Liberado", pagamentos: [],
    ...over,
  };
}

describe("HistoricoTabela", () => {
  it("marca consumo de pacote quando pacote não é nulo", () => {
    render(
      <HistoricoTabela
        atendimentos={[
          atendimento({ id: 1, pacote: 3, servico_nome: "Banho" }),
          atendimento({ id: 2, pacote: null, servico_nome: "Banho e Tosa" }),
        ]}
      />,
    );

    expect(screen.getAllByText("Pacote")).toHaveLength(1);
    expect(screen.getAllByText("Avulso")).toHaveLength(1);
  });

  it("mostra o valor mesmo em consumo de pacote (o valor nunca é zerado)", () => {
    render(<HistoricoTabela atendimentos={[atendimento({ pacote: 3, valor: "60.00" })]} />);

    expect(screen.getByText("R$ 60,00")).toBeInTheDocument();
  });

  it("formata a data no padrão brasileiro", () => {
    render(<HistoricoTabela atendimentos={[atendimento({ data: "2026-07-01" })]} />);

    expect(screen.getByText("01/07/2026")).toBeInTheDocument();
  });
});
```

Criar `frontend/src/pages/PetDetalhe.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { renderizarComProvedores } from "../test/utils";
import { server } from "../test/msw/server";
import { PetDetalhe } from "./PetDetalhe";

const BASE = "http://localhost:8000/api";

function petJson(vip: boolean) {
  return {
    id: 7, tutor: 1, tutor_nome: "Ana Clara", nome: "Luna", raca: "Shih Tzu", porte: "P",
    ativo: true, created_at: "2026-07-01", vip, qtd_visitas: vip ? 3 : 1, total_gasto: "150.00",
  };
}

const SEM_ATENDIMENTOS = { count: 0, next: null, previous: null, results: [] };

function montar() {
  return renderizarComProvedores(<PetDetalhe />, { rota: "/pets/7", caminho: "/pets/:id" });
}

describe("PetDetalhe", () => {
  it("mostra o badge VIP quando o pet é VIP", async () => {
    server.use(
      http.get(`${BASE}/pets/7/`, () => HttpResponse.json(petJson(true))),
      http.get(`${BASE}/atendimentos/`, () => HttpResponse.json(SEM_ATENDIMENTOS)),
    );

    montar();

    expect(await screen.findByText("VIP")).toBeInTheDocument();
  });

  it("não mostra o badge VIP quando o pet não é VIP", async () => {
    server.use(
      http.get(`${BASE}/pets/7/`, () => HttpResponse.json(petJson(false))),
      http.get(`${BASE}/atendimentos/`, () => HttpResponse.json(SEM_ATENDIMENTOS)),
    );

    montar();

    await screen.findByRole("heading", { name: "Luna" });
    expect(screen.queryByText("VIP")).not.toBeInTheDocument();
  });

  it("pagina o histórico e pede a página 2", async () => {
    const paginas: string[] = [];
    server.use(
      http.get(`${BASE}/pets/7/`, () => HttpResponse.json(petJson(true))),
      http.get(`${BASE}/atendimentos/`, ({ request }) => {
        paginas.push(new URL(request.url).searchParams.get("page") ?? "");
        return HttpResponse.json({
          count: 120, next: "x", previous: null,
          results: [
            {
              id: 1, pet: 7, servico: 1, servico_nome: "Banho", pacote: null,
              data: "2026-07-01", horario: "10:00:00", valor: "95.00",
              transporte: false, transporte_valor: "0.00", status: "Liberado", pagamentos: [],
            },
          ],
        });
      }),
    );

    montar();

    expect(await screen.findByText("Página 1 de 3")).toBeInTheDocument();
    expect(paginas).toContain("1");

    await userEvent.click(screen.getByRole("button", { name: "Próxima" }));

    await waitFor(() => expect(paginas).toContain("2"));
    expect(await screen.findByText("Página 2 de 3")).toBeInTheDocument();
  });

  it("mostra estado vazio quando o pet não tem histórico", async () => {
    server.use(
      http.get(`${BASE}/pets/7/`, () => HttpResponse.json(petJson(false))),
      http.get(`${BASE}/atendimentos/`, () => HttpResponse.json(SEM_ATENDIMENTOS)),
    );

    montar();

    expect(await screen.findByText("Nenhum atendimento ainda")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- src/pages/PetDetalhe.test.tsx src/components/clientes/HistoricoTabela.test.tsx`
Expected: FAIL com `Failed to resolve import "./PetDetalhe"`

- [ ] **Step 3: Implementar**

Criar `frontend/src/components/clientes/HistoricoTabela.tsx`:

```tsx
import type { Atendimento, StatusAtendimento } from "../../lib/types";
import { Badge } from "../ui/Badge";

const VARIANTE_STATUS: Record<StatusAtendimento, "sucesso" | "pendente" | "erro"> = {
  Liberado: "sucesso",
  Pendente: "pendente",
  Cancelado: "erro",
};

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarValor(valor: string): string {
  return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
}

export function HistoricoTabela({ atendimentos }: { atendimentos: Atendimento[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
            <th className="px-6 py-3 font-semibold">Data</th>
            <th className="px-2 py-3 font-semibold">Serviço</th>
            <th className="px-2 py-3 font-semibold">Origem</th>
            <th className="px-2 py-3 font-semibold">Status</th>
            <th className="px-6 py-3 text-right font-semibold">Valor</th>
          </tr>
        </thead>
        <tbody>
          {atendimentos.map((a) => (
            <tr
              key={a.id}
              className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50"
            >
              <td className="px-6 py-4 font-mono text-neutro">{formatarData(a.data)}</td>
              <td className="px-2 py-4 font-medium text-escuro">{a.servico_nome}</td>
              <td className="px-2 py-4">
                {/* Consumo de pacote se reconhece pelo vínculo, nunca por valor zero. */}
                <Badge variant={a.pacote !== null ? "neutro" : "pendente"}>
                  {a.pacote !== null ? "Pacote" : "Avulso"}
                </Badge>
              </td>
              <td className="px-2 py-4">
                <Badge variant={VARIANTE_STATUS[a.status]}>{a.status}</Badge>
              </td>
              <td className="px-6 py-4 text-right font-mono font-semibold text-escuro">
                {formatarValor(a.valor)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Criar `frontend/src/pages/PetDetalhe.tsx`:

```tsx
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { EstadoVazio } from "../components/EstadoVazio";
import { HistoricoTabela } from "../components/clientes/HistoricoTabela";
import { PetForm } from "../components/clientes/PetForm";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Paginacao } from "../components/ui/Paginacao";
import { useAtendimentosDoPet } from "../hooks/useAtendimentos";
import { useAtualizarPet, useDesativarPet, usePet } from "../hooks/usePets";

const ROTULOS_PORTE: Record<string, string> = {
  "": "Porte não informado",
  P: "Pequeno",
  M: "Médio",
  G: "Grande",
};

export function PetDetalhe() {
  const { id } = useParams();
  const petId = Number(id);
  const navigate = useNavigate();
  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState(false);

  const pet = usePet(petId);
  const historico = useAtendimentosDoPet(petId, pagina);
  const atualizar = useAtualizarPet(petId);
  const desativar = useDesativarPet();

  if (pet.isError) return <ErroAoCarregar aoTentarDeNovo={() => pet.refetch()} />;
  if (pet.isPending) return <p className="text-sm text-neutro">Carregando...</p>;

  function aoDesativar() {
    if (!window.confirm("Desativar este pet? Ele sai das listas, mas o histórico fica.")) return;
    desativar.mutate(petId, { onSuccess: () => navigate(`/clientes/${pet.data.tutor}`) });
  }

  return (
    <div>
      <nav className="text-xs text-neutro">
        <Link to="/clientes" className="hover:text-marsala">
          Clientes
        </Link>{" "}
        /{" "}
        <Link to={`/clientes/${pet.data.tutor}`} className="hover:text-marsala">
          {pet.data.tutor_nome}
        </Link>{" "}
        / {pet.data.nome}
      </nav>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl text-escuro">{pet.data.nome}</h1>
            {pet.data.vip && <Badge variant="vip">VIP</Badge>}
          </div>
          <p className="mt-1 text-sm text-neutro">
            {pet.data.raca || "Sem raça definida"} · {ROTULOS_PORTE[pet.data.porte]} ·{" "}
            <span className="font-mono">{pet.data.qtd_visitas}</span> visitas nos últimos 12 meses
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditando(true)}>
            Editar
          </Button>
          <Button variant="danger" onClick={aoDesativar} disabled={desativar.isPending}>
            Desativar
          </Button>
        </div>
      </div>

      <h2 className="mt-10 font-display text-xl text-escuro">Histórico de atendimentos</h2>

      <div className="mt-4">
        {historico.isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => historico.refetch()} />
        ) : historico.isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : historico.data.count === 0 ? (
          <EstadoVazio
            titulo="Nenhum atendimento ainda"
            descricao="Os atendimentos deste pet aparecem aqui."
          />
        ) : (
          <>
            <HistoricoTabela atendimentos={historico.data.results} />
            <Paginacao pagina={pagina} count={historico.data.count} aoMudar={setPagina} />
          </>
        )}
      </div>

      <Modal aberto={editando} titulo="Editar pet" aoFechar={() => setEditando(false)}>
        <PetForm
          tutorId={pet.data.tutor}
          inicial={{ nome: pet.data.nome, raca: pet.data.raca, porte: pet.data.porte }}
          enviando={atualizar.isPending}
          aoCancelar={() => setEditando(false)}
          aoSalvar={(dados) => atualizar.mutate(dados, { onSuccess: () => setEditando(false) })}
        />
      </Modal>
    </div>
  );
}
```

Em `frontend/src/routes/router.tsx`, acrescentar o import e a rota:

```tsx
import { PetDetalhe } from "../pages/PetDetalhe";
```

e, dentro do array `children` do `AppShell`, logo abaixo de `{ path: "/clientes/:id", element: <TutorDetalhe /> }`:

```tsx
          { path: "/pets/:id", element: <PetDetalhe /> },
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test -- src/pages/PetDetalhe.test.tsx src/components/clientes/HistoricoTabela.test.tsx`
Expected: PASS, 7 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PetDetalhe.tsx frontend/src/pages/PetDetalhe.test.tsx frontend/src/components/clientes/HistoricoTabela.tsx frontend/src/components/clientes/HistoricoTabela.test.tsx frontend/src/routes/router.tsx
git commit -m "feat: build PetDetalhe page with VIP badge and paginated history"
```

---

### Task 13: Verificação de ponta a ponta e relatório de estudos

**Files:**
- Create: `estudos/PR-10-front-clientes.md` (pasta não versionada)

**Interfaces:**
- Consumes: tudo. Nenhum código novo.

- [ ] **Step 1: Suíte completa do backend**

Run (em `backend/`): `./.venv/Scripts/python.exe -m pytest -q`
Expected: todos os testes passam, incluindo os do dashboard e do faturamento (que não podem ter regredido)

Run: `./.venv/Scripts/python.exe -m ruff check .`
Expected: `All checks passed!`

Run: `./.venv/Scripts/python.exe manage.py makemigrations --check --dry-run`
Expected: `No changes detected`

- [ ] **Step 2: Suíte completa do frontend**

Run (em `frontend/`): `npm run test`
Expected: todos os arquivos de teste passam

Run: `npm run build`
Expected: build sem erro de tipo

- [ ] **Step 3: Verificação manual contra a API real**

```bash
cd backend && ./.venv/Scripts/python.exe manage.py seed_dev
./.venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000
```

Em outro terminal, `cd frontend && npm run dev`. Abrir `http://localhost:5173/clientes` e conferir, nesta ordem:

1. Os 4 tutores do seed aparecem na lista.
2. Buscar "Ana" filtra para um.
3. Abrir Ana Clara: Luna aparece **com** badge VIP (3 banhos), Thor **sem**.
4. Abrir Rafael Lima: Mel aparece **com** badge VIP (um atendimento de R$600).
5. Abrir Bruno Teixeira: **Pipoca aparece na lista** mesmo sem nenhum atendimento. Este é o teste visual do `LEFT JOIN`.
6. Abrir Nina (tutor Camila): **sem** badge VIP, porque o único atendimento dela tem 400 dias.
7. Abrir Luna: o histórico mostra 3 linhas, todas marcadas "Avulso", com valores visíveis.
8. Cadastrar um tutor novo pelo modal: a lista atualiza sozinha e o modal fecha.
9. Desativar o tutor novo: ele some da lista.

> Se a porta 8000 estiver ocupada por outro container Docker, o `frontend/.env` já aponta para `127.0.0.1:8000` de propósito. Ver o comentário no arquivo.

- [ ] **Step 4: Escrever o relatório didático**

Criar `estudos/PR-10-front-clientes.md` cobrindo, com o "porquê" de cada escolha e não só o "o quê":

1. **A agregação condicional.** `Count(..., filter=Q(...))` versus `.filter()` no queryset. Mostrar o SQL dos dois (`print(qs.query)`), explicar `INNER JOIN` contra `LEFT OUTER JOIN`, e por que o `Coalesce` é necessário no `Sum`.
2. **Por que o booleano `vip` não é anotado no SQL.** O `DashboardView` serializa `pets_vip` com o mesmo `PetSerializer`; derivar no serializer faz as duas telas concordarem sem duplicar a regra.
3. **`SerializerMethodField` e o objeto do `create`.** Por que `get_queryset()` não cobre o POST.
4. **A janela de 365 dias.** Por que um critério sem janela satura e o badge vira ruído.
5. **`keepPreviousData` e debounce.** O que cada um resolve (piscar versus request por tecla), e por que os dois juntos.
6. **Query keys e invalidação.** Por que `["tutores"]` como raiz invalida lista e detalhe de uma vez.
7. **Radix Dialog.** O que é focus trap, por que ele é difícil de fazer à mão, e por que o `<select>` nativo não precisou de Radix.
8. **A flag do redirect 401.** Por que N queries paralelas viram N navegações.

- [ ] **Step 5: Commit e abrir o PR**

```bash
git add -A
git commit -m "docs: add PR 10 implementation plan"
git push -u origin feat/front-clientes
gh pr create --title "PR 10: Clientes & Pets" --body "Implementa docs/specs/2026-07-10-pr10-front-clientes-design.md"
```

`estudos/` está no `.gitignore` e não entra no commit.

---

## Auto-revisão do plano

**Cobertura da spec.** Todas as seções da spec têm task: `anota_vip` (1), `PetSerializer` (2), `servico_nome` (3), `seed_dev` (4), dívida do PR 9 (5), tipos e hooks (6), `Modal` e `Select` (7), `Paginacao`/`EstadoVazio`/`ErroAoCarregar` (8), formulários (9), as três páginas (10, 11, 12), rotas (11 e 12), relatório de estudos (13). Os oito testes de pytest e os sete de Vitest listados na spec estão escritos por extenso.

**Divergência da spec, consciente.** A spec dizia "`anota_vip` anota `qtd_visitas`, `total_gasto` e `vip`". Ao escrever o plano ficou claro que anotar o booleano no SQL do `PetViewSet` faria o `DashboardView` (que serializa `pets_vip` com o mesmo `PetSerializer`) responder `"vip": false` para a própria lista de VIPs. O plano anota só os dois números e deriva o booleano no serializer, com as constantes vindas de `services`. O comportamento externo da API é o que a spec pede.

**Placeholders.** Nenhum. Todo passo que muda código traz o código completo.

**Consistência de nomes.** `anota_vip`, `VIP_MIN_VISITAS`, `VIP_MIN_GASTO`, `VIP_JANELA_DIAS`, `qtd_visitas`, `total_gasto`, `vip`, `servico_nome`, `Paginated<T>`, `TAMANHO_PAGINA`, `chavesTutores`, `chavesPets`, `chavesAtendimentos`, `renderizarComProvedores`, `aoSalvar`, `aoCancelar`, `aoFechar`, `aoMudar`, `aoTentarDeNovo`, `enviando` são usados com a mesma grafia em todas as tasks.

**Auditoria adversarial (subagente Fable 5, 2026-07-10).** Uma segunda passada caçou defeitos contra o código real. Dez achados corrigidos inline: imports no fim do arquivo disparavam E402 (Task 2); `pet = PetFactory()` não usado disparava F841 (Task 1); a fixture `api_dashboard` não existe, o dashboard reusa a `api` (Task 2); o `EstadoVazio` sem busca renderiza um segundo botão "Novo tutor", quebrando `findByRole` singular (Task 10); o seed com datas relativas a `date.today()` duplicava atendimentos a cada dia, agora recria (Task 4); a mensagem do seed passou a usar contadores locais (Task 4); o teste de paginação agora clica em "Próxima" e checa `page=2` (Task 12); a assinatura de `useAtualizar*` na lista de Interfaces (Task 6); o comentário do `Modal` contradizia o código, agora usa `aria-describedby={undefined}` (Task 7); o comentário do seed sobre quais pets ficam sem atendimento (Task 4). Um achado (o stub de `window.location` no jsdom, Task 5) foi **refutado** por smoke test real em vitest 4 + jsdom 29: `vi.stubGlobal("location", {assign})` intercepta corretamente.
