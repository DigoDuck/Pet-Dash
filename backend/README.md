# Backend (Django + DRF)

API do PetDash: Django 5.2 + Django REST Framework, autenticação JWT (SimpleJWT), PostgreSQL.

## Rodar local

```bash
python -m venv .venv
.venv\Scripts\activate              # Windows (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env                # ajuste DATABASE_URL para o seu Postgres
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver          # http://localhost:8000
```

Seeds disponíveis:

- `python manage.py seed_catalogo` — catálogo real de serviços (idempotente, usado também em produção).
- `python manage.py seed_dev` — tutores, pets e atendimentos de exemplo para desenvolvimento.

## Testes e lint

```bash
pytest                              # suíte completa (pytest-django + factory_boy)
pytest tests/test_x.py::test_y      # um teste específico
ruff check .                        # lint
```

## Estrutura

```text
config/     # settings (por env vars), urls, wsgi
core/       # models, services (faturamento/dashboard), serializers, views, seeds
tests/      # suíte pytest; as invariantes financeiras têm teste dedicado
```

A regra de faturamento e o saldo de pacote são **derivados** (calculados em `core/services.py` e nos models), nunca armazenados. Antes de mexer em `models.py`, `services.py` ou `serializers.py`, ler as invariantes em [CLAUDE.md](../CLAUDE.md).

## Deploy

Railway, com config-as-code em `railway.toml` (gunicorn + whitenoise, hardening condicionado a `DEBUG=false`). Guia completo em [docs/deploy.md](../docs/deploy.md).
