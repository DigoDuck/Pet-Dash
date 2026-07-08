# Deploy — Railway (API + Postgres)

> Runbook da sessão de deploy. Pré-requisito: plano ativo na conta Railway.
> O código já está deploy-ready (PR 8): `railway.toml`, gunicorn, WhiteNoise,
> settings de produção via env.

## 1. Criar os serviços

1. Railway → New Project → **Deploy from GitHub repo** → `Pet-Dash`.
2. No serviço criado: Settings → **Root Directory = `backend`** (sem isso a
   Railway não acha o Django nem o `railway.toml`).
3. No projeto: **Create → Database → PostgreSQL**.

> O primeiro build automático (disparado ao conectar o repo) pode falhar: ele roda antes do Root Directory e das variáveis estarem configurados (sem `SECRET_KEY`, o `collectstatic` do build quebra). É esperado — configure as Seções 1 a 3 e dispare um **Redeploy**.

## 2. Variáveis de ambiente (serviço da API)

| Variável | Valor | Observação |
| --- | --- | --- |
| `SECRET_KEY` | chave nova e forte | gerar: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DEBUG` | `false` | |
| `ALLOWED_HOSTS` | `<app>.up.railway.app,healthcheck.railway.app` | o healthchecker da Railway usa o host `healthcheck.railway.app` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | reference ao serviço Postgres |
| `CORS_ALLOWED_ORIGINS` | `https://<front>.vercel.app` | com scheme `https://` (o system check do django-cors-headers falha sem ele e bloqueia o release); pode ficar sem setar até o front existir |
| `CSRF_TRUSTED_ORIGINS` | `https://<app>.up.railway.app` | admin sob HTTPS |

`SECURE_SSL_REDIRECT` não precisa ser setada (default `true` em produção).

## 3. Domínio público

Settings do serviço → Networking → **Generate Domain**. Usar esse domínio em
`ALLOWED_HOSTS` e `CSRF_TRUSTED_ORIGINS`.

## 4. Primeiro deploy

O push na `main` (ou o Deploy manual) builda com Railpack: `pip install` +
`collectstatic` no build, `migrate` no pré-deploy, gunicorn no start. O deploy
só fica healthy quando `/api/health/` responder 200.

## 5. Superuser (Patricia)

Com o CLI da Railway logado e linkado ao projeto (`railway link`), abrir um shell **dentro do container** do serviço da API:

```bash
railway ssh
python manage.py createsuperuser
```

> Não usar `railway shell`: ele abre um subshell **local** com as env vars do serviço injetadas, e a `DATABASE_URL` de private networking (`postgres.railway.internal`) não resolve fora do container — o `createsuperuser` falharia na conexão.

## 6. Smoke test

```bash
# 1. Health
curl -s https://<app>.up.railway.app/api/health/
# esperado: {"status":"ok"}

# 2. Token JWT
curl -s -X POST https://<app>.up.railway.app/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"<user>","password":"<senha>"}'
# esperado: {"refresh":"...","access":"..."}

# 3. GET autenticado
curl -s https://<app>.up.railway.app/api/tutores/ \
  -H "Authorization: Bearer <access>"
# esperado: página paginada (200), não 401

# 4. CORS (preflight simulando o front)
curl -s -i -X OPTIONS https://<app>.up.railway.app/api/tutores/ \
  -H "Origin: https://<front>.vercel.app" \
  -H "Access-Control-Request-Method: GET"
# esperado: header access-control-allow-origin com a origem do front
```

## 7. Pós-estabilização (backlog do deploy)

- Subir `SECURE_HSTS_SECONDS` de 30 dias para 1 ano.
- Vercel: entra no primeiro PR do frontend (Fase 2).
