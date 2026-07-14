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

## 6. Catálogo de serviços

No mesmo `railway ssh`, logo após o superuser:

```bash
python manage.py seed_catalogo
```

Cria os 8 serviços reais do Ângelo Spa (extraídos da planilha da Patricia). É idempotente
(`get_or_create` por nome): rodar duas vezes não duplica, e **não sobrescreve preço que a
Patricia já tenha corrigido pela tela**.

> Rodar isto **antes** de entregar a URL para ela. Se ela cadastrar "banho" pela tela antes
> do seed, o comando cria um "Banho" separado e o catálogo fica com duplicata de grafia.

`seed_dev` é outra coisa: dados fictícios, e ele **aborta** se `DEBUG=False`. Nunca em produção.

## 7. Frontend (Vercel)

1. Vercel → New Project → mesmo repo `Pet-Dash`.
2. **Root Directory = `frontend`**. Framework: Vite (autodetectado).
3. Environment Variables: `VITE_API_URL` = `https://<app>.up.railway.app/api`.
   É lida em build time (`import.meta.env`), então **mudar a variável exige um redeploy** —
   não basta salvar no painel.
4. Deploy.

O `frontend/vercel.json` já traz o rewrite de SPA (`/(.*)` → `/index.html`). Sem ele, o app
carrega na home mas um F5 em `/clientes` devolve **404 da Vercel**: o React Router é
client-side e a Vercel procuraria um arquivo `/clientes` que não existe.

## 8. Amarrar o CORS

De volta ao painel da Railway, no serviço da API:

- `CORS_ALLOWED_ORIGINS` = `https://<front>.vercel.app` (com o `https://`; sem o scheme o
  system check do django-cors-headers derruba o release).

**Redeploy** — variável nova na Railway só vale em deploy novo. Esquecer o redeploy é o
segundo erro clássico de CORS, logo depois de esquecer o scheme.

## 9. Smoke test

```bash
SMOKE_PASS='<senha>' python scripts/smoke.py https://<app>.up.railway.app --user <user>
```

Exercita health, login JWT, 401 sem token, catálogo semeado, round-trip de escrita
(cria um tutor "SMOKE TEST" e o soft-deleta) e os três endpoints do dashboard.
Sai com código != 0 no primeiro problema.

O preflight de CORS o script não cobre (urllib não faz preflight); esse continua no curl:

```bash
curl -s -i -X OPTIONS https://<app>.up.railway.app/api/tutores/ \
  -H "Origin: https://<front>.vercel.app" \
  -H "Access-Control-Request-Method: GET"
# esperado: header access-control-allow-origin com a origem do front
```

Fecha com um login manual no front, que é o único passo que prova a integração inteira.

## 10. Pós-estabilização (backlog do deploy)

- Subir `SECURE_HSTS_SECONDS` de 30 dias para 1 ano.
- Não habilitar App Sleeping na Railway: o cold start faria a Patricia esperar no primeiro
  acesso de cada dia. O `TIMEOUT` do smoke já é generoso (30s) por causa disso.
- Custo: Railway não tem tier gratuito permanente (~US$5/mês mínimo, API + Postgres no mesmo
  crédito). Acompanhar o painel de usage no primeiro mês.
