# PetDash — Plano de projeto (design doc)

> Data: 2026-07-02. Aprovado por Diogo em sessão de brainstorming.
> Fontes: `PetDash - Spec.md` (modelagem, vault), `PetDash.md` (brief, vault), brand book Ângelo Spa Animal, protótipo Lovable "Pet Grooming Dashboard".

## Contexto

App web de gestão operacional e financeira do Ângelo Spa Animal, usuária única (Patricia), substituindo planilha de ~130 atendimentos/mês. Stack: Django + DRF, React (Vite) + Tailwind, PostgreSQL. Produção: Railway (API + banco) e Vercel (front). O repositório está em estado greenfield (apenas skeleton).

A modelagem de dados e as invariantes de negócio estão fechadas na spec do vault e resumidas no `CLAUDE.md` do repo. Este documento define o plano de execução: escopo do MVP, decisões técnicas restantes, fases, PRs e convenções.

## Escopo do MVP (decidido em 2026-07-02)

- **Dashboard segue somente a spec**: KPIs derivados por query (faturamento, ticket médio, lucro, margem, saldo) + top tutores por gasto. Saldo bancário, meta mensal, conciliação "fechar o mês", busca global e notificações do protótipo Lovable ficam **fora** do MVP.
- **Agenda (calendário semanal) fica para a fase 2 do produto**. O MVP tem lista de atendimentos com filtros (data, status, pet). Os status do protótipo ("Agendado"/"A confirmar") não existem no modelo; o mapeamento futuro é Pendente = agendado, Liberado = realizado.
- O protótipo Lovable é referência visual estática (regra permanente do projeto). Antes de portar qualquer componente: `grep -r "supabase"` e remover resquícios. A persona exibida no app é Patricia (o protótipo mostra "Ângelo Duarte", corrigir ao portar).

## Decisões técnicas

1. **Auth: JWT via `djangorestframework-simplejwt`.** Front (Vercel) e API (Railway) em domínios diferentes tornam session/cookie cross-site frágil (SameSite/CSRF). Usuária única criada por `createsuperuser`; sem registro, sem RBAC.
2. **Estrutura Django: app único `core`.** Domínio pequeno e acoplado (Atendimento referencia Pet, Servico, PacoteContratado). Apps por área agora só gerariam import circular; extrair depois se crescer.
3. **Frontend: Vite + React Router + TanStack Query + react-hook-form + zod.** TanStack Query cuida de cache/estados de servidor sem Redux. Tailwind configurado com os tokens da marca (marsala `#7B2332`, ouro `#C9A44C`, creme `#FDF8F0`; DM Serif Display / Inter / JetBrains Mono).
4. **CI desde o PR 1**: GitHub Actions com `pytest` (e `vitest` quando o front existir) em todo PR.
5. **Deploy cedo**: Railway + Vercel sobem na fase 1 (PR 8), com front placeholder, para tirar o risco de infra do fim do projeto.

## Fases e PRs

### Fase 0 — Fundação backend

| PR | Branch | Conteúdo | Tamanho |
|---|---|---|---|
| 1 | `chore/backend-scaffold` | Django + DRF, settings por env, Postgres, pytest-django, ruff, GitHub Actions | M |
| 2 | `feat/models-base` | `Tutor`, `Pet`, `Servico` + admin + factories + testes (soft-delete, PROTECT) | S |
| 3 | `feat/models-operacao` | `PacoteContratado`, `Atendimento`, `Pagamento`, `Custo`, `Retirada`. `UNIQUE(pet, competencia)`, manager de faturamento (regime de caixa), saldo derivado do pacote. Testes das invariantes: sem dupla contagem pacote/avulso, filtro `pacote_id IS NULL`, ciclo Pendente→Liberado→Cancelado, `valor` nunca zerado | L — PR mais crítico |

### Fase 1 — API

| PR | Branch | Conteúdo | Tamanho |
|---|---|---|---|
| 4 | `feat/api-auth` | simplejwt, django-cors-headers, healthcheck | S |
| 5 | `feat/api-cadastros` | ViewSets Tutor/Pet/Servico com busca e filtros | M |
| 6 | `feat/api-atendimentos-pacotes` | Atendimento com pagamentos aninhados (validação `sum(Pagamento.valor) == Atendimento.valor` para avulsos, no serializer), venda de pacote, endpoint "pacote ativo do pet no mês" | L |
| 7 | `feat/api-financeiro` | Custos, retiradas, endpoint de dashboard (agregações + VIP por annotation + top tutores) | M |
| 8 | `chore/deploy` | Railway (API + Postgres) + Vercel (placeholder), envs, CORS de produção | M |

### Fase 2 — Frontend (slices verticais contra a API real)

| PR | Branch | Conteúdo | Tamanho |
|---|---|---|---|
| 9 | `feat/front-scaffold` | Vite + Tailwind com tokens da marca, componentes base (Button, Badge, Card, Input), AppShell portado do Lovable, login + rota protegida, Vitest/RTL | L |
| 10 | `feat/front-clientes` | Clientes & Pets: lista, cadastro, detalhe com histórico e badge VIP | M |
| 11 | `feat/front-servicos` | Catálogo de serviços | S |
| 12 | `feat/front-atendimentos` | Lista com filtros + form. Fluxo crítico: ao escolher pet, a UI busca pacote ativo e pré-vincula `pacote_id` | L |
| 13 | `feat/front-pacotes` | Venda de pacote, saldo por pet, validade editável | M |
| 14 | `feat/front-financeiro` | Custos por competência + retiradas | M |
| 15 | `feat/front-dashboard` | KPIs derivados, gráfico mensal, top tutores | M |
| 16 | `chore/entrega` | Seed do catálogo real, ajustes finais, smoke test em produção | S |

Dependências de ordem: atendimentos (12) exigem clientes (10) e serviços (11); dashboard (15) exige todos os dados.

## Backlog — fase 2 do produto (fora do MVP)

Agenda semanal visual · meta mensal de faturamento · conciliação "fechar o mês" · saldo bancário · busca global · notificações · PWA/offline-first.

## Convenções de versionamento

- Branch por PR (`feat/`, `chore/`); merge em `main` apenas com CI verde; squash merge.
- Commits em inglês, estilo conventional (`feat:`, `fix:`, `test:`, `chore:`), sem trailer de coautoria.
- Tracking de tasks: nota `06 - Agentes/PetDash - Tasks.md` no vault Obsidian, atualizada a cada PR mergeado.

## Riscos concentrados

1. **PR 3 (models de operação)**: se as invariantes de faturamento nascerem erradas, todo o financeiro acima corrompe. Mitigação: testes unitários das 5 regras da spec antes de qualquer endpoint.
2. **PR 12 (form de atendimento)**: se a UI não sugerir/forçar o vínculo do pacote, o atendimento vira avulso e fatura em dobro (mesmo erro humano da planilha). Mitigação: endpoint dedicado de pacote ativo + pré-vínculo automático no form.
3. **Dependência de internet em produção**: risco aceito no MVP (fallback de dados móveis no estabelecimento).
