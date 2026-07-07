# PetDash Fase 0 — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend Django com os 8 models da spec, constraint de competência única e regra de faturamento em regime de caixa coberta por testes, entregue em 3 PRs revisáveis.

**Architecture:** Projeto Django `config` + app único `core` dentro de `backend/`. Settings 100% por variável de ambiente (django-environ). Regra de faturamento encapsulada em `core/services.py` + `AtendimentoQuerySet`; saldo de pacote é método derivado, nunca campo. Testes com pytest-django + factory-boy contra PostgreSQL (nunca SQLite — as constraints importam).

**Tech Stack:** Python 3.13 · Django ≥5.2,<6 · DRF ≥3.16 · psycopg 3 · django-environ · pytest-django · factory-boy · ruff · GitHub Actions.

## Global Constraints

- Todo código backend vive em `backend/`; o workflow de CI vive em `.github/workflows/ci.yml` (raiz do repo).
- Commits em inglês, conventional (`feat:`, `test:`, `chore:`), **sem trailer de coautoria**.
- Comentários e docstrings podem ser em PT-BR.
- Fluxo por PR: branch a partir de `main` → commits → push → `gh pr create` → **parar e aguardar revisão do Diogo + CI verde + squash merge** antes de iniciar o PR seguinte.
- Testes sempre contra PostgreSQL via `DATABASE_URL`. SQLite é proibido neste projeto.
- Invariantes da spec (copiadas verbatim do design doc, não flexibilizar):
  - Faturamento período = `Σ PacoteContratado.valor_pago (data_compra no período)` + `Σ Atendimento.valor` dos avulsos (`pacote_id IS NULL`) com status `Liberado` no período.
  - Atendimento de consumo de pacote NÃO fatura; o que o exclui é `pacote_id` preenchido, não valor zero. `valor` nunca é zerado.
  - Saldo do pacote = `qtd_total - COUNT(atendimentos do pacote WHERE status != 'Cancelado')`. Não existe campo `qtd_usada`.
  - `UNIQUE(pet_id, competencia)` no `PacoteContratado` (constraint de banco).
  - Status de Atendimento: `Liberado` / `Pendente` / `Cancelado`. Pendente ocupa crédito; Cancelado devolve.
  - FKs de Tutor/Pet/Servico com `PROTECT`; soft-delete via `ativo`.
- A validação `sum(Pagamento.valor) == Atendimento.valor` (avulsos) é do serializer e fica para a Fase 1 (PR 6) — NÃO implementar aqui.

## File Structure

```
backend/
  manage.py                  # gerado pelo startproject
  config/
    settings.py              # env-driven (única settings; env muda por ambiente)
    urls.py                  # admin apenas, nesta fase
    wsgi.py / asgi.py        # gerados
  core/
    models.py                # os 8 models (domínio pequeno; um arquivo é idiomático)
    services.py              # faturamento_periodo() — a regra de negócio central
    admin.py                 # registro dos models
    migrations/
  tests/
    __init__.py
    factories.py             # factory-boy, uma factory por model
    test_smoke.py            # sanidade do scaffold (PR 1)
    test_models_base.py      # Tutor/Pet/Servico (PR 2)
    test_models_operacao.py  # constraint, saldo, ciclo de status (PR 3)
    test_faturamento.py      # invariantes de faturamento (PR 3)
  pyproject.toml             # config de pytest + ruff
  requirements.txt / requirements-dev.txt
  .env.example               # .env real nunca commitado
.github/workflows/ci.yml
```

---

## PR 1 · `chore/backend-scaffold`

### Task 1: Pré-requisitos, branch e dependências

**Files:**

- Create: `backend/requirements.txt`, `backend/requirements-dev.txt`

**Interfaces:**

- Produces: venv em `backend/.venv` com Django/DRF/pytest instalados; usado por todas as tasks seguintes. Comando python nas tasks seguintes = `backend/.venv/Scripts/python.exe` (Windows).

- [ ] **Step 1: Verificar pré-requisitos**

Run: `python --version && psql --version`
Expected: `Python 3.13.x` e `psql (PostgreSQL) 16.x` (ou superior).
Se `psql` não existir: instalar com `winget install PostgreSQL.PostgreSQL.16` OU subir via Docker: `docker run -d --name petdash-pg -e POSTGRES_USER=petdash -e POSTGRES_PASSWORD=petdash -e POSTGRES_DB=petdash -p 5432:5432 postgres:16`. Parar e avisar o Diogo se nenhuma opção estiver disponível.

- [ ] **Step 2: Criar branch**

```bash
git checkout main && git pull && git checkout -b chore/backend-scaffold
```

- [ ] **Step 3: Criar requirements**

`backend/requirements.txt`:

```
Django>=5.2,<6.0
djangorestframework>=3.16
django-environ>=0.12
psycopg[binary]>=3.2
```

`backend/requirements-dev.txt`:

```
pytest>=8.3
pytest-django>=4.11
factory-boy>=3.3
ruff>=0.11
```

- [ ] **Step 4: Criar venv e instalar**

```bash
cd backend && python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt -r requirements-dev.txt
```

Expected: instalação sem erros.

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/requirements-dev.txt
git commit -m "chore: add backend dependency manifests"
```

### Task 2: Projeto Django, settings por env e smoke test

**Files:**

- Create: `backend/manage.py`, `backend/config/*` (via startproject), `backend/core/` (via startapp), `backend/.env.example`, `backend/.env` (local, não commitado), `backend/tests/__init__.py`, `backend/tests/test_smoke.py`
- Modify: `backend/config/settings.py` (substituir por completo), `.gitignore` (raiz)

**Interfaces:**

- Produces: `config.settings` lendo `SECRET_KEY`, `DEBUG`, `DATABASE_URL`, `ALLOWED_HOSTS` do ambiente; app `core` instalado; banco local `petdash` migrado. Todas as tasks de teste seguintes dependem disso.

- [ ] **Step 1: Gerar projeto e app**

```bash
cd backend
.venv/Scripts/django-admin.exe startproject config .
.venv/Scripts/python.exe manage.py startapp core
```

- [ ] **Step 2: Substituir `backend/config/settings.py` por inteiro**

```python
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(DEBUG=(bool, False))
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {"default": env.db("DATABASE_URL")}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Bahia"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
```

- [ ] **Step 3: Criar `.env.example` (commitado) e `.env` (local)**

`backend/.env.example`:

```
SECRET_KEY=change-me
DEBUG=true
DATABASE_URL=postgres://petdash:petdash@localhost:5432/petdash
ALLOWED_HOSTS=localhost,127.0.0.1
```

Copiar para `backend/.env` e gerar uma SECRET_KEY real:

```bash
cp .env.example .env
.venv/Scripts/python.exe -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Colar a chave gerada no `.env`.

- [ ] **Step 4: Atualizar `.gitignore` da raiz (append)**

```
# Python / Django
backend/.venv/
__pycache__/
*.pyc
backend/.env
backend/staticfiles/
```

- [ ] **Step 5: Criar banco local e migrar**

```bash
psql -U postgres -c "CREATE USER petdash WITH PASSWORD 'petdash' CREATEDB;" -c "CREATE DATABASE petdash OWNER petdash;"
.venv/Scripts/python.exe manage.py migrate
```

Expected: `Applying ... OK` para as migrations padrão. (Se usou Docker no Task 1, o banco já existe; rodar só o migrate.)

- [ ] **Step 6: Escrever o smoke test**

`backend/tests/__init__.py`: arquivo vazio.

`backend/tests/test_smoke.py`:

```python
import pytest

pytestmark = pytest.mark.django_db


def test_admin_esta_acessivel(client):
    assert client.get("/admin/login/").status_code == 200
```

- [ ] **Step 7: Commit**

```bash
git add backend/ .gitignore
git commit -m "chore: scaffold Django project with env-driven settings"
```

### Task 3: pytest + ruff + CI, abrir o PR 1

**Files:**

- Create: `backend/pyproject.toml`, `.github/workflows/ci.yml`

**Interfaces:**

- Produces: `pytest` executável de `backend/` sem flags; `ruff check .` limpo; CI rodando ambos em todo PR. Todos os PRs seguintes dependem deste gate.

- [ ] **Step 1: Criar `backend/pyproject.toml`**

```toml
[tool.pytest.ini_options]
DJANGO_SETTINGS_MODULE = "config.settings"
python_files = ["test_*.py"]
testpaths = ["tests"]

[tool.ruff]
line-length = 100
target-version = "py313"
extend-exclude = ["core/migrations"]

[tool.ruff.lint]
select = ["E", "F", "I", "B", "DJ"]
```

- [ ] **Step 2: Rodar pytest e ruff localmente**

Run: `cd backend && .venv/Scripts/python.exe -m pytest -v && .venv/Scripts/python.exe -m ruff check .`
Expected: `1 passed` (smoke test) e `All checks passed!`. Corrigir imports/format se o ruff apontar (gerados pelo startproject costumam passar).

- [ ] **Step 3: Criar `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: petdash
          POSTGRES_PASSWORD: petdash
          POSTGRES_DB: petdash
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U petdash"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgres://petdash:petdash@localhost:5432/petdash
      SECRET_KEY: ci-only-secret-key
      DEBUG: "false"
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.13"
          cache: pip
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: ruff check .
      - run: pytest -v
```

- [ ] **Step 4: Commit, push e abrir o PR**

```bash
git add backend/pyproject.toml .github/
git commit -m "chore: add pytest/ruff config and CI workflow"
git push -u origin chore/backend-scaffold
gh pr create --title "chore: backend scaffold (Django + DRF + CI)" --body "Django 5 + DRF project skeleton with env-driven settings, pytest-django, ruff and GitHub Actions CI (Postgres service). Smoke test hits /admin/login/. No domain models yet."
```

- [ ] **Step 5: CHECKPOINT — aguardar CI verde + revisão do Diogo + squash merge antes do PR 2.**

---

## PR 2 · `feat/models-base`

### Task 4: Models Tutor, Pet e Servico (TDD)

**Files:**

- Create: `backend/tests/factories.py`, `backend/tests/test_models_base.py`, `backend/core/migrations/0001_initial.py` (gerada)
- Modify: `backend/core/models.py`

**Interfaces:**

- Consumes: scaffold do PR 1.
- Produces: models `core.Tutor`, `core.Pet`, `core.Servico`; factories `TutorFactory`, `PetFactory`, `ServicoFactory` (import: `from tests.factories import ...`). O PR 3 constrói sobre os três.

- [ ] **Step 1: Criar branch**

```bash
git checkout main && git pull && git checkout -b feat/models-base
```

- [ ] **Step 2: Escrever factories e testes que falham**

`backend/tests/factories.py`:

```python
from decimal import Decimal

import factory

from core import models


class TutorFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Tutor

    nome = factory.Sequence(lambda n: f"Tutor {n}")
    telefone = "71999367531"


class PetFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Pet

    tutor = factory.SubFactory(TutorFactory)
    nome = factory.Sequence(lambda n: f"Pet {n}")
    raca = "SRD"


class ServicoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Servico

    nome = factory.Sequence(lambda n: f"Serviço {n}")
    preco_padrao = Decimal("95.00")
```

`backend/tests/test_models_base.py`:

```python
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
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_models_base.py -v`
Expected: FAIL/ERROR com `AttributeError: module 'core.models' has no attribute 'Tutor'`.

- [ ] **Step 4: Escrever os models**

Substituir `backend/core/models.py` por:

```python
from django.db import models


class Tutor(models.Model):
    nome = models.CharField(max_length=120)
    telefone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, default="")
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "tutores"

    def __str__(self):
        return self.nome


class Pet(models.Model):
    class Porte(models.TextChoices):
        PEQUENO = "P", "Pequeno"
        MEDIO = "M", "Médio"
        GRANDE = "G", "Grande"

    tutor = models.ForeignKey(Tutor, on_delete=models.PROTECT, related_name="pets")
    nome = models.CharField(max_length=80)
    raca = models.CharField(max_length=80, blank=True, default="")
    porte = models.CharField(max_length=1, choices=Porte.choices, blank=True, default="")
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nome} ({self.tutor.nome})"


class Servico(models.Model):
    nome = models.CharField(max_length=100)
    # Só sugestão de preenchimento; Atendimento.valor é o snapshot que vale.
    preco_padrao = models.DecimalField(max_digits=8, decimal_places=2)
    is_pacote = models.BooleanField(default=False)
    creditos = models.PositiveSmallIntegerField(null=True, blank=True)
    ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "servicos"

    def __str__(self):
        return self.nome
```

- [ ] **Step 5: Gerar migration e rodar os testes**

```bash
.venv/Scripts/python.exe manage.py makemigrations core
.venv/Scripts/python.exe -m pytest tests/test_models_base.py -v
```

Expected: migration `0001_initial.py` criada; `4 passed`.

- [ ] **Step 6: Commit**

```bash
git add backend/core/ backend/tests/
git commit -m "feat: add Tutor, Pet and Servico models with soft-delete and PROTECT"
```

### Task 5: Admin dos models base, abrir o PR 2

**Files:**

- Modify: `backend/core/admin.py`

**Interfaces:**

- Produces: admin navegável para conferência manual de dados durante o desenvolvimento.

- [ ] **Step 1: Registrar no admin**

Substituir `backend/core/admin.py` por:

```python
from django.contrib import admin

from .models import Pet, Servico, Tutor


@admin.register(Tutor)
class TutorAdmin(admin.ModelAdmin):
    list_display = ["nome", "telefone", "ativo"]
    search_fields = ["nome", "telefone"]


@admin.register(Pet)
class PetAdmin(admin.ModelAdmin):
    list_display = ["nome", "tutor", "raca", "porte", "ativo"]
    search_fields = ["nome", "tutor__nome"]
    list_filter = ["porte", "ativo"]


@admin.register(Servico)
class ServicoAdmin(admin.ModelAdmin):
    list_display = ["nome", "preco_padrao", "is_pacote", "creditos", "ativo"]
    list_filter = ["is_pacote", "ativo"]
```

- [ ] **Step 2: Rodar a suíte completa + ruff**

Run: `.venv/Scripts/python.exe -m pytest -v && .venv/Scripts/python.exe -m ruff check .`
Expected: `5 passed`, ruff limpo.

- [ ] **Step 3: Commit, push e abrir o PR**

```bash
git add backend/core/admin.py
git commit -m "feat: register base models in Django admin"
git push -u origin feat/models-base
gh pr create --title "feat: base models (Tutor, Pet, Servico)" --body "First domain models per spec: soft-delete via ativo, PROTECT FKs, preco_padrao as suggestion only. Includes factories and unit tests."
```

- [ ] **Step 4: CHECKPOINT — aguardar CI + revisão + squash merge antes do PR 3.**

---

## PR 3 · `feat/models-operacao`

### Task 6: PacoteContratado e Atendimento — constraint, saldo e ciclo de status (TDD)

**Files:**

- Create: `backend/tests/test_models_operacao.py`, `backend/core/migrations/0002_*.py` (gerada)
- Modify: `backend/core/models.py` (append), `backend/tests/factories.py` (append)

**Interfaces:**

- Consumes: `Tutor`/`Pet`/`Servico` e factories do PR 2.
- Produces: `core.PacoteContratado` (método `saldo() -> int`, constraint `unique_pacote_pet_competencia`), `core.Atendimento` (`Atendimento.Status` com valores `"Liberado"`, `"Pendente"`, `"Cancelado"`; manager `Atendimento.objects` com `.liberados()`, `.avulsos()`, `.no_periodo(inicio, fim)`). Task 8 consome tudo isso.

- [ ] **Step 1: Criar branch**

```bash
git checkout main && git pull && git checkout -b feat/models-operacao
```

- [ ] **Step 2: Escrever os testes que falham**

`backend/tests/test_models_operacao.py`:

```python
from datetime import date, time
from decimal import Decimal

import pytest
from django.db import IntegrityError

from core.models import Atendimento
from tests.factories import AtendimentoFactory, PacoteContratadoFactory, PetFactory

pytestmark = pytest.mark.django_db

JUN = date(2026, 6, 1)


def test_um_pacote_por_pet_por_competencia():
    pacote = PacoteContratadoFactory(competencia=JUN)
    with pytest.raises(IntegrityError):
        PacoteContratadoFactory(pet=pacote.pet, competencia=JUN)


def test_pets_diferentes_podem_ter_pacote_na_mesma_competencia():
    PacoteContratadoFactory(competencia=JUN)
    PacoteContratadoFactory(competencia=JUN, pet=PetFactory())  # não levanta


def test_saldo_e_derivado_e_pendente_ocupa_credito():
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
    assert pacote.saldo() == 3

    atendimento.status = Atendimento.Status.CANCELADO
    atendimento.save()

    assert pacote.saldo() == 4
    assert pacote.atendimentos.count() == 1  # histórico preservado


def test_consumo_de_pacote_guarda_valor_de_referencia():
    # Invariante: valor NUNCA é zerado, mesmo em atendimento de pacote.
    pacote = PacoteContratadoFactory()
    atendimento = AtendimentoFactory(
        pacote=pacote, pet=pacote.pet, valor=Decimal("65.00"),
        status=Atendimento.Status.LIBERADO,
    )
    assert atendimento.valor == Decimal("65.00")


def test_queryset_avulsos_liberados_no_periodo():
    avulso = AtendimentoFactory(
        status=Atendimento.Status.LIBERADO, data=date(2026, 6, 10)
    )
    AtendimentoFactory(status=Atendimento.Status.PENDENTE, data=date(2026, 6, 11))
    AtendimentoFactory(status=Atendimento.Status.LIBERADO, data=date(2026, 7, 1))
    pacote = PacoteContratadoFactory()
    AtendimentoFactory(
        pacote=pacote, pet=pacote.pet,
        status=Atendimento.Status.LIBERADO, data=date(2026, 6, 12),
    )

    resultado = Atendimento.objects.avulsos().liberados().no_periodo(
        date(2026, 6, 1), date(2026, 6, 30)
    )
    assert list(resultado) == [avulso]


def test_horario_padrao_e_status_padrao():
    atendimento = AtendimentoFactory()
    assert atendimento.status == Atendimento.Status.PENDENTE
    assert atendimento.horario == time(14, 30)
```

Append em `backend/tests/factories.py`:

```python
from datetime import date, time  # mover para o topo do arquivo, junto do import de Decimal


class PacoteContratadoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.PacoteContratado

    pet = factory.SubFactory(PetFactory)
    servico = factory.SubFactory(ServicoFactory, is_pacote=True, creditos=4, nome="Pacote Fidelidade")
    competencia = date(2026, 6, 1)
    qtd_total = 4
    valor_pago = Decimal("220.00")
    data_compra = date(2026, 6, 3)
    validade = date(2026, 6, 30)


class AtendimentoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Atendimento

    pet = factory.SubFactory(PetFactory)
    servico = factory.SubFactory(ServicoFactory)
    pacote = None
    data = date(2026, 6, 10)
    horario = time(14, 30)
    valor = Decimal("95.00")
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_models_operacao.py -v`
Expected: ERROR com `AttributeError: module 'core.models' has no attribute 'PacoteContratado'`.

- [ ] **Step 4: Implementar os models**

Append em `backend/core/models.py`:

```python
class PacoteContratado(models.Model):
    pet = models.ForeignKey(Pet, on_delete=models.PROTECT, related_name="pacotes")
    servico = models.ForeignKey(Servico, on_delete=models.PROTECT, related_name="pacotes")
    competencia = models.DateField(help_text="Dia 1 do mês de referência")
    qtd_total = models.PositiveSmallIntegerField(default=4)
    valor_pago = models.DecimalField(max_digits=8, decimal_places=2)
    data_compra = models.DateField()
    validade = models.DateField(help_text="Editável — reagendamento autorizado estende aqui")
    ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "pacotes contratados"
        constraints = [
            models.UniqueConstraint(
                fields=["pet", "competencia"], name="unique_pacote_pet_competencia"
            ),
        ]

    def __str__(self):
        return f"{self.pet.nome} · {self.competencia:%m/%Y}"

    def saldo(self):
        # Derivado, nunca armazenado. Pendente ocupa; Cancelado devolve.
        return self.qtd_total - self.atendimentos.exclude(
            status=Atendimento.Status.CANCELADO
        ).count()


class AtendimentoQuerySet(models.QuerySet):
    def liberados(self):
        return self.filter(status=Atendimento.Status.LIBERADO)

    def avulsos(self):
        # O que exclui do faturamento é pacote preenchido, não valor zero.
        return self.filter(pacote__isnull=True)

    def no_periodo(self, inicio, fim):
        return self.filter(data__range=(inicio, fim))


class Atendimento(models.Model):
    class Status(models.TextChoices):
        LIBERADO = "Liberado", "Liberado"
        PENDENTE = "Pendente", "Pendente"
        CANCELADO = "Cancelado", "Cancelado"

    pet = models.ForeignKey(Pet, on_delete=models.PROTECT, related_name="atendimentos")
    servico = models.ForeignKey(Servico, on_delete=models.PROTECT, related_name="atendimentos")
    pacote = models.ForeignKey(
        PacoteContratado,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="atendimentos",
    )
    data = models.DateField()
    horario = models.TimeField()
    # Snapshot do preço cobrado no dia. Nunca zerar (corrompe ticket médio).
    valor = models.DecimalField(max_digits=8, decimal_places=2)
    transporte = models.BooleanField(default=False)
    transporte_valor = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDENTE)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = AtendimentoQuerySet.as_manager()

    def __str__(self):
        return f"{self.pet.nome} · {self.servico.nome} · {self.data}"
```

- [ ] **Step 5: Gerar migration e rodar**

```bash
.venv/Scripts/python.exe manage.py makemigrations core
.venv/Scripts/python.exe -m pytest tests/test_models_operacao.py -v
```

Expected: `7 passed`.

- [ ] **Step 6: Commit**

```bash
git add backend/core/ backend/tests/
git commit -m "feat: add PacoteContratado and Atendimento with derived saldo and unique competencia"
```

### Task 7: Pagamento, Custo e Retirada (TDD)

**Files:**

- Create: `backend/core/migrations/0003_*.py` (gerada)
- Modify: `backend/core/models.py` (append), `backend/tests/factories.py` (append), `backend/tests/test_models_operacao.py` (append)

**Interfaces:**

- Consumes: `Atendimento` da Task 6.
- Produces: `core.Pagamento` (`Pagamento.Metodo`: `"Pix"`, `"Cartao"`, `"Dinheiro"`; related_name `pagamentos`), `core.Custo` (`Custo.Tipo`: `"fixo"`, `"variavel"`), `core.Retirada`. Fase 1 consome nos serializers.

- [ ] **Step 1: Escrever os testes que falham (append em `test_models_operacao.py`)**

```python
def test_pagamento_misto_sao_duas_linhas():
    from tests.factories import PagamentoFactory

    atendimento = AtendimentoFactory(valor=Decimal("120.00"))
    PagamentoFactory(atendimento=atendimento, metodo="Pix", valor=Decimal("80.00"))
    PagamentoFactory(atendimento=atendimento, metodo="Dinheiro", valor=Decimal("40.00"))
    assert atendimento.pagamentos.count() == 2


def test_custo_tem_competencia_mensal():
    from tests.factories import CustoFactory

    custo = CustoFactory(competencia=JUN)
    assert custo.tipo == "fixo"
    assert custo.competencia == JUN
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `.venv/Scripts/python.exe -m pytest tests/test_models_operacao.py -v`
Expected: ERROR `ImportError: cannot import name 'PagamentoFactory'`.

- [ ] **Step 3: Implementar models e factories**

Append em `backend/core/models.py`:

```python
class Pagamento(models.Model):
    class Metodo(models.TextChoices):
        PIX = "Pix", "Pix"
        CARTAO = "Cartao", "Cartão"
        DINHEIRO = "Dinheiro", "Dinheiro"

    atendimento = models.ForeignKey(
        Atendimento, on_delete=models.CASCADE, related_name="pagamentos"
    )
    metodo = models.CharField(max_length=10, choices=Metodo.choices)
    valor = models.DecimalField(max_digits=8, decimal_places=2)

    def __str__(self):
        return f"{self.metodo} · R$ {self.valor}"


class Custo(models.Model):
    class Tipo(models.TextChoices):
        FIXO = "fixo", "Fixo"
        VARIAVEL = "variavel", "Variável"

    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    descricao = models.CharField(max_length=200)
    valor = models.DecimalField(max_digits=8, decimal_places=2)
    categoria = models.CharField(max_length=60, blank=True, default="")
    competencia = models.DateField(help_text="Dia 1 do mês de referência")

    def __str__(self):
        return f"{self.descricao} · {self.competencia:%m/%Y}"


class Retirada(models.Model):
    descricao = models.CharField(max_length=200)
    valor = models.DecimalField(max_digits=8, decimal_places=2)
    data = models.DateField()
    tipo = models.CharField(max_length=60, blank=True, default="")

    def __str__(self):
        return f"{self.descricao} · {self.data}"
```

Append em `backend/tests/factories.py`:

```python
class PagamentoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Pagamento

    atendimento = factory.SubFactory(AtendimentoFactory)
    metodo = "Pix"
    valor = Decimal("95.00")


class CustoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Custo

    tipo = "fixo"
    descricao = "Aluguel"
    valor = Decimal("2400.00")
    competencia = date(2026, 6, 1)
```

- [ ] **Step 4: Migration e testes**

```bash
.venv/Scripts/python.exe manage.py makemigrations core
.venv/Scripts/python.exe -m pytest tests/test_models_operacao.py -v
```

Expected: `9 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/core/ backend/tests/
git commit -m "feat: add Pagamento, Custo and Retirada models"
```

### Task 8: Serviço de faturamento — a invariante central (TDD)

**Files:**

- Create: `backend/core/services.py`, `backend/tests/test_faturamento.py`

**Interfaces:**

- Consumes: models e queryset da Task 6/7.
- Produces: `core.services.faturamento_periodo(inicio: date, fim: date) -> Decimal`. O endpoint de dashboard (Fase 1, PR 7) chama exatamente esta função — nunca reimplementa a soma.

- [ ] **Step 1: Escrever os testes que falham**

`backend/tests/test_faturamento.py`:

```python
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
    # A receita do pacote entrou na venda; o banho de consumo tem valor
    # de referência > 0 mas pacote preenchido, então NÃO soma de novo.
    pacote = PacoteContratadoFactory(
        valor_pago=Decimal("220.00"), data_compra=date(2026, 6, 3)
    )
    AtendimentoFactory(
        pacote=pacote, pet=pacote.pet, valor=Decimal("65.00"),
        status=Atendimento.Status.LIBERADO, data=date(2026, 6, 10),
    )
    assert faturamento_periodo(INICIO_JUN, FIM_JUN) == Decimal("220.00")


def test_avulso_pendente_nao_fatura():
    AtendimentoFactory(
        valor=Decimal("95.00"), status=Atendimento.Status.PENDENTE, data=date(2026, 6, 10)
    )
    assert faturamento_periodo(INICIO_JUN, FIM_JUN) == Decimal("0")


def test_faturamento_respeita_o_periodo():
    # Pacote vendido em maio e avulso de julho ficam fora de junho.
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
    # Cenário integrado: pacote + consumos + avulsos misturados no mesmo mês.
    pacote = PacoteContratadoFactory(
        valor_pago=Decimal("220.00"), data_compra=date(2026, 6, 2)
    )
    for dia in (2, 9, 16, 23):  # 4 banhos do pacote, valor de referência 65
        AtendimentoFactory(
            pacote=pacote, pet=pacote.pet, valor=Decimal("65.00"),
            status=Atendimento.Status.LIBERADO, data=date(2026, 6, dia),
        )
    AtendimentoFactory(
        valor=Decimal("95.00"), status=Atendimento.Status.LIBERADO, data=date(2026, 6, 15)
    )
    AtendimentoFactory(
        valor=Decimal("160.00"), status=Atendimento.Status.LIBERADO, data=date(2026, 6, 20)
    )
    # 220 (pacote) + 95 + 160 (avulsos). Os 4 consumos de 65 NÃO entram.
    assert faturamento_periodo(INICIO_JUN, FIM_JUN) == Decimal("475.00")
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `.venv/Scripts/python.exe -m pytest tests/test_faturamento.py -v`
Expected: ERROR `ModuleNotFoundError: No module named 'core.services'`.

- [ ] **Step 3: Implementar o serviço**

`backend/core/services.py`:

```python
"""Regras financeiras derivadas — nunca materializadas (spec: evitar drift)."""

from datetime import date
from decimal import Decimal

from django.db.models import Sum

from .models import Atendimento, PacoteContratado


def faturamento_periodo(inicio: date, fim: date) -> Decimal:
    """Faturamento em regime de caixa.

    = Σ PacoteContratado.valor_pago com data_compra no período
    + Σ Atendimento.valor dos avulsos (pacote IS NULL) Liberados no período.

    Consumo de pacote não soma: a receita já entrou na venda.
    """
    pacotes = PacoteContratado.objects.filter(
        data_compra__range=(inicio, fim)
    ).aggregate(total=Sum("valor_pago"))["total"] or Decimal("0")

    avulsos = (
        Atendimento.objects.avulsos()
        .liberados()
        .no_periodo(inicio, fim)
        .aggregate(total=Sum("valor"))["total"]
        or Decimal("0")
    )

    return pacotes + avulsos
```

- [ ] **Step 4: Rodar e ver passar**

Run: `.venv/Scripts/python.exe -m pytest tests/test_faturamento.py -v`
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/core/services.py backend/tests/test_faturamento.py
git commit -m "feat: add cash-basis faturamento service with invariant tests"
```

### Task 9: Admin dos models de operação, abrir o PR 3

**Files:**

- Modify: `backend/core/admin.py`

**Interfaces:**

- Produces: admin completo dos 8 models.

- [ ] **Step 1: Registrar os novos models (append em `backend/core/admin.py`)**

```python
from .models import Atendimento, Custo, PacoteContratado, Pagamento, Retirada  # noqa: E402


class PagamentoInline(admin.TabularInline):
    model = Pagamento
    extra = 0


@admin.register(Atendimento)
class AtendimentoAdmin(admin.ModelAdmin):
    list_display = ["pet", "servico", "data", "valor", "status", "pacote"]
    list_filter = ["status", "data"]
    search_fields = ["pet__nome", "pet__tutor__nome"]
    inlines = [PagamentoInline]


@admin.register(PacoteContratado)
class PacoteContratadoAdmin(admin.ModelAdmin):
    list_display = ["pet", "competencia", "qtd_total", "valor_pago", "validade", "ativo"]
    list_filter = ["competencia", "ativo"]


@admin.register(Custo)
class CustoAdmin(admin.ModelAdmin):
    list_display = ["descricao", "tipo", "valor", "categoria", "competencia"]
    list_filter = ["tipo", "competencia"]


@admin.register(Retirada)
class RetiradaAdmin(admin.ModelAdmin):
    list_display = ["descricao", "valor", "data", "tipo"]
```

Nota: consolidar os imports no topo do arquivo em um único `from .models import ...` e remover o `# noqa` (o ruff vai apontar; deixar o arquivo final com um import só).

- [ ] **Step 2: Suíte completa + ruff**

Run: `.venv/Scripts/python.exe -m pytest -v && .venv/Scripts/python.exe -m ruff check .`
Expected: `19 passed` (1 smoke + 4 base + 9 operação + 5 faturamento), ruff limpo.

- [ ] **Step 3: Commit, push e abrir o PR**

```bash
git add backend/core/admin.py
git commit -m "feat: register operational models in admin"
git push -u origin feat/models-operacao
gh pr create --title "feat: operational models + cash-basis faturamento" --body "PacoteContratado + Atendimento (critical pair), Pagamento, Custo, Retirada. DB constraint UNIQUE(pet, competencia). Derived saldo (Pendente holds credit, Cancelado returns it). faturamento_periodo() implements the cash-basis invariant with tests covering double-count prevention. Closes Fase 0."
```

- [ ] **Step 4: CHECKPOINT — revisão do Diogo + CI + squash merge. Fase 0 concluída; atualizar a nota de tasks no vault.**
