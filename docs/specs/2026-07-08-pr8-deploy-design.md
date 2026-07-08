# PR 8 · `chore/deploy` — Design

> Detalha o esboço do PR 8 do plano da Fase 1 (`docs/plans/2026-07-07-fase-1-api.md`).
> Decisão de sessão (2026-07-08): o PR entrega o backend **deploy-ready** e é mergeado
> sem deploy real; o deploy na Railway acontece em sessão curta posterior, quando o
> plano da conta Railway estiver ativo. Sem novo PR para isso.

## Contexto

- Contas: Vercel pronta; Railway criada mas **sem plano ativo** (Diogo escolhe depois).
- `frontend/` ainda não foi scaffoldado (só README), então não existe nada para pôr na Vercel.
- Pré-requisito de branch: PR 7 (`feat/api-financeiro`) mergeado na main. O branch
  `chore/deploy` nasceu da main no merge do PR 6; após o merge do PR 7, atualizar com
  `git merge main` antes de abrir o PR.
- O settings já é 100% dirigido por env (`django-environ`), o que reduz o PR a:
  dependências de produção, hardening do settings, config da Railway e runbook.

## Decisões (fechadas nesta sessão)

1. **Abordagem A — Railpack + `railway.toml`, sem Dockerfile.** A Railway builda o
   projeto Python sozinha (builder Railpack). O `railway.toml` versionado declara start
   command, pré-deploy e healthcheck. Dockerfile só se um dia migrarmos de host.
2. **Vercel adiada.** Vai junto com o primeiro PR do frontend (Fase 2). Um placeholder
   estático não valida nada de útil; o CORS de produção é env-driven e smoke-testável
   com `curl -H "Origin: ..."`.
3. **Settings único, sem split dev/prod.** O bloco de produção é condicionado a
   `DEBUG=false`. Split de settings seria over-engineering para single-user.

## Escopo

### 1. Dependências (`backend/requirements.txt`)

- `gunicorn` — servidor WSGI de produção (o `runserver` é só dev).
- `whitenoise` — serve os estáticos do admin pelo próprio Django (sem Nginx/S3).

### 2. Settings de produção (`backend/config/settings.py`)

- Middleware `whitenoise.middleware.WhiteNoiseMiddleware` logo após o
  `SecurityMiddleware`.
- `STATIC_ROOT = BASE_DIR / "staticfiles"` e `STORAGES` com
  `CompressedManifestStaticFilesStorage` (hash no nome do arquivo + compressão).
- Bloco condicionado a `not DEBUG`:
  - `SECURE_SSL_REDIRECT = True` + `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")`
    (a Railway termina TLS no proxy; sem o header o redirect entra em loop).
  - HSTS: `SECURE_HSTS_SECONDS = 2_592_000` (30 dias; valor inicial conservador,
    subir para 1 ano quando o deploy estiver estável).
  - `SESSION_COOKIE_SECURE` e `CSRF_COOKIE_SECURE`.
- `CSRF_TRUSTED_ORIGINS` via env (default vazio) — necessário para o admin sob HTTPS.
- Meta: `python manage.py check --deploy` sem warnings relevantes com `DEBUG=false`.

### 3. Config da Railway (`backend/railway.toml`)

- Builder Railpack.
- `preDeployCommand = "python manage.py migrate"` (roda a cada release, antes do app subir).
- `startCommand = "gunicorn config.wsgi --bind 0.0.0.0:$PORT"`.
- `healthcheckPath = "/api/health/"` (endpoint existente desde o PR 4).
- `collectstatic` explícito no build (não confiar na detecção automática do
  Railpack; declarar o comando no `railway.toml`).
- Config de painel (não versionável, documentada no runbook): **Root Directory =
  `backend`**, já que o Django mora num subdiretório do repo.

### 4. Runbook (`docs/deploy.md`)

Passo a passo para a sessão de deploy:

- Criar serviço a partir do repo GitHub + Postgres plugin.
- Tabela de env vars de produção: `SECRET_KEY` (nova, forte), `DEBUG=false`,
  `ALLOWED_HOSTS`, `DATABASE_URL` (reference ao Postgres da Railway),
  `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`.
- Criar o superuser (Patricia) via shell da Railway.
- Smoke test: `GET /api/health/` → 200 · obter par de tokens JWT · um `GET`
  autenticado · CORS via `curl` com header `Origin`.

### 5. Verificação do PR (sem deploy real)

`gunicorn` não roda no Windows, então a evidência local é:

- `pytest` verde e `ruff check .` limpo.
- `python manage.py check --deploy` ok com `DEBUG=false`.
- `collectstatic` + `runserver` com `DEBUG=false` servindo o CSS do admin
  (prova de que o WhiteNoise serve estáticos de produção).

### 6. Fora do escopo

- Vercel / frontend (Fase 2).
- CI/CD (a Railway auto-deploya a main).
- O deploy real (sessão posterior, pós-ativação do plano Railway).

## Encerramento do PR

Relatório didático `estudos/PR-08-deploy.md`, no padrão dos PRs anteriores.
