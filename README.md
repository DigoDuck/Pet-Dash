# PetDash

App web de gestão operacional e financeira para o **Ângelo Spa Animal**, um spa de banho e estética animal. Substitui o controle por planilha (~130 atendimentos/mês) por um sistema de usuária única, 100% web, em que todo número financeiro é calculado a partir dos registros de origem.

## Funcionalidades

- **Clientes e pets**: cadastro com histórico de atendimentos e badge VIP calculado no backend (3+ visitas ou R$ 500 gastos em 365 dias).
- **Catálogo de serviços**: CRUD com preço por faixa de peso e ativar/desativar sem apagar histórico.
- **Atendimentos**: registro com preço definido no dia, pagamentos mistos (ex.: Pix + dinheiro) e vínculo automático com o pacote ativo do pet.
- **Pacote Fidelidade**: cota mensal de banhos com venda, saldo por pet e validade editável.
- **Financeiro**: custos (fixos e variáveis) e retiradas lançados por competência mensal.
- **Dashboard**: faturamento, lucro, margem e ticket médio em regime de caixa, com série mensal comparativa.
- **Agenda**: grade semanal (terça a domingo) dos atendimentos.

## Stack

| Camada | Tecnologias |
| --- | --- |
| Backend | Python 3.13, Django 5.2, Django REST Framework, SimpleJWT |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Hook Form + Zod |
| Banco | PostgreSQL |
| Testes | pytest-django + factory_boy (backend), Vitest + Testing Library + MSW (frontend) |
| Qualidade | ruff, oxlint, CI no GitHub Actions |
| Produção | Railway (API + Postgres) e Vercel (frontend) |

## Decisões de modelagem

As regras que protegem o dinheiro vivem nos models e services, nunca espalhadas pelas views:

- **Financeiro derivado, nunca materializado.** Faturamento, lucro, margem e ticket médio são agregações em query; nada é persistido, o que elimina drift entre o dado de origem e o relatório.
- **Faturamento em regime de caixa.** Soma pacotes vendidos no período, atendimentos avulsos liberados e a receita de transporte de todos os atendimentos. O consumo de pacote não soma de novo (já foi pago na venda).
- **Saldo do pacote é calculado**, não armazenado: `qtd_total - COUNT(atendimentos não cancelados)`. O ciclo de status Pendente → Liberado → Cancelado ocupa, consome e devolve o crédito.
- **Pricing snapshotado.** O valor do atendimento é o preço cobrado no dia; o catálogo só sugere. Relatório histórico nunca faz JOIN com preço atual.
- **Pagamento é tabela 1-N**, não enum: pagamento misto vira N linhas e a conciliação por método sai de um `GROUP BY`.
- **Soft-delete** em tutores e pets, com FKs `PROTECT`, para o histórico financeiro nunca evaporar.

Cada invariante tem teste unitário desde o primeiro commit. O detalhamento está em [CLAUDE.md](CLAUDE.md) e nos design docs de [docs/](docs/).

## Como rodar localmente

Pré-requisitos: Python 3.13+, Node 20+ e um PostgreSQL local.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate              # Windows (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env                # ajuste DATABASE_URL para o seu Postgres
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_catalogo      # catálogo de serviços
python manage.py seed_dev           # dados de exemplo (opcional)
python manage.py runserver          # http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env                # VITE_API_URL aponta para a API local
npm run dev                         # http://localhost:5173
```

### Testes e lint

```bash
cd backend && pytest && ruff check .
cd frontend && npm run test && npm run lint
```

## Estrutura

```text
backend/    # API Django + DRF (config/, core/, tests/)
frontend/   # SPA React + Vite (src/)
docs/       # design docs e planos por PR, guia de deploy
scripts/    # smoke test de produção
```

## Deploy

Backend e Postgres na Railway (config-as-code em `backend/railway.toml`), frontend na Vercel. Passo a passo e checklist em [docs/deploy.md](docs/deploy.md); verificação pós-deploy com [scripts/smoke.py](scripts/smoke.py).
