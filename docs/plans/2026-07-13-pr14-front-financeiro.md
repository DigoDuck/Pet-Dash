# PR 14 · `feat/front-financeiro` — Implementation Plan

**Goal:** Dar à Patricia a tela onde ela lança os custos do mês e as retiradas — a base que hoje só existe
no admin do Django e sem a qual o lucro e a margem do Dashboard (PR 15) seriam calculados sobre custo zero.

**Architecture:** Fatia vertical fina. O backend ganha filtro por intervalo de data nas retiradas e
desempate de ordenação (habilitadores, ~6 linhas). O frontend ganha `/financeiro`: um seletor de mês
governando dois cards de total (vindos do `/dashboard/`, invariante 9) e duas seções CRUD (Custos e
Retiradas) no molde do `Servicos.tsx`.

**Spec:** `docs/specs/2026-07-13-pr14-front-financeiro-design.md`

## Global Constraints

- Branch: `feat/front-financeiro`, a partir do `main` com o PR 13 mergeado (`849faea`).
- Comentários de código em **português**; mensagens de commit em **inglês**, conventional. Sem trailer de
  coautoria nem selo de IA.
- Backend: `pytest` e `ruff check .` verdes (rodar de dentro de `backend/`, venv ativa).
- Frontend: `npm run test`, `npm run lint` e `npm run build` verdes (de dentro de `frontend/`).
- Invariante 9: nenhum total somado no cliente. Os cards leem `/api/dashboard/`.
- Invariante 10: custo pertence a uma competência; editar junho não toca maio.
- Nada de tocar em `services.py` (faturamento/saldo são do Diogo pelo contrato de aprendizado); este PR
  apenas **consome** `dashboard_periodo`, que já existe e está testado.

---

### Task 1: Backend — filtro por intervalo nas retiradas e ordenação estável

**Files:** `backend/core/views.py` (`CustoViewSet`, `RetiradaViewSet`) · `backend/tests/test_api_financeiro.py`

**Produz o contrato:** `GET /api/retiradas/?data__gte=YYYY-MM-DD&data__lte=YYYY-MM-DD` (e `?data=` exato
continua valendo) · `GET /api/custos/?competencia=YYYY-MM-01&tipo=fixo`.

- [ ] Teste que falha: retiradas de junho via `data__gte`/`data__lte` devolvem só as do intervalo (criar
      uma de julho para provar o recorte). Sem o filtro declarado, o django-filter ignora o parâmetro em
      silêncio e o `count` volta com todas — falha por número errado, não por erro.
- [ ] `RetiradaViewSet.filterset_fields = {"data": ["exact", "gte", "lte"]}`. O `exact` **fica**:
      `test_filtra_retirada_por_data` depende dele.
- [ ] Desempate de ordenação: `Custo` por `("-competencia", "descricao")`, `Retirada` por
      `("-data", "descricao")`. Sem isso a ordem das linhas do mesmo mês é indefinida no Postgres e a
      paginação pode repetir ou pular lançamentos.
- [ ] `pytest && ruff check .` verdes.
- [ ] Commit: `feat: filter retiradas by date range and stabilize financeiro ordering`

### Task 2: Frontend — `lib/formato.ts`

**Files:** `frontend/src/lib/formato.ts` (+ teste) · substituir as 5 cópias em `pages/Pacotes.tsx`,
`pages/Servicos.tsx`, `components/clientes/HistoricoTabela.tsx`,
`components/atendimentos/AtendimentoTabela.tsx`, `components/atendimentos/PagamentosField.tsx`.

- [ ] `formatarPreco(valor: string | number): string` → `"R$ 1200,00"`. Teste unitário.
- [ ] Trocar as 5 definições locais pelo import. Os testes existentes dessas telas são a rede de segurança.
- [ ] `npm run test` verde (nenhuma regressão nas 5 telas).
- [ ] Commit: `refactor: extract formatarPreco into lib/formato`

### Task 3: Frontend — tipos e hooks

**Files:** `lib/types.ts` · `hooks/useCustos.ts` · `hooks/useRetiradas.ts` · `hooks/useDashboard.ts` (+ testes)

**Produz:**

- `Custo`, `CustoEntrada`, `Retirada`, `RetiradaEntrada`, `ResumoFinanceiro`.
- `useCustos(competencia, tipo, pagina)` · `useCriarCusto()` · `useAtualizarCusto(id)` · `useExcluirCusto()`
- `useRetiradas(inicio, fim, pagina)` · `useCriarRetirada()` · `useAtualizarRetirada(id)` · `useExcluirRetirada()`
- `useDashboard(inicio, fim)` → `ResumoFinanceiro` (o PR 15 reusa este hook inteiro).

- [ ] Teste que falha: (a) `useCustos` manda `competencia`, `tipo` e `page` na query; (b) `useRetiradas`
      manda `data__gte`/`data__lte`; (c) **criar um custo invalida a chave `["dashboard"]`** — é o teste
      que impede o card de total mentir depois de um lançamento.
- [ ] Implementar. `invalidarFinanceiro(client)` compartilhada pelos dois hooks de mutação invalida a
      lista **e** `["dashboard"]`.
- [ ] Commit: `feat: add Custo/Retirada types and hooks with dashboard invalidation`

### Task 4: Frontend — `CustoForm` e `RetiradaForm`

**Files:** `components/financeiro/CustoForm.tsx`, `components/financeiro/RetiradaForm.tsx` (+ testes)

- [ ] `CustoForm`: descrição (obrigatória), tipo (`Select` fixo/variável), valor (`> 0`), categoria
      (livre), competência (`<input type="month">`, default = mês da página; enviada como `YYYY-MM-01`).
- [ ] `RetiradaForm`: descrição (obrigatória), valor (`> 0`), data (default = hoje, ou dia 1 se o mês
      selecionado não for o corrente), tipo (livre).
- [ ] Testes: valor zero e descrição vazia não chamam `aoSalvar`; a competência sai como dia 1; a edição
      carrega os valores salvos.
- [ ] Commit: `feat: add CustoForm and RetiradaForm with client-side validation`

### Task 5: Frontend — página `/financeiro`

**Files:** `components/financeiro/{ResumoMes,CustosSecao,RetiradasSecao}.tsx` · `pages/Financeiro.tsx` (+ teste)

A rota `/financeiro` e o link na Sidebar já existem (o `<EmConstrucao />` é substituído).

- [ ] `ResumoMes`: dois `Card` (Custos do mês · Retiradas do mês) alimentados por `useDashboard`.
- [ ] `CustosSecao`: filtro Todos/Fixo/Variável, tabela, "Novo custo", editar, excluir (`window.confirm`
      dizendo que a exclusão é permanente e muda o fechamento do mês).
- [ ] `RetiradasSecao`: idem, sem o filtro de tipo.
- [ ] `Financeiro.tsx`: só o `<input type="month">` e a composição. Cada seção guarda seu estado.
- [ ] Testes: as duas seções renderizam o mês corrente; trocar o mês refaz as três consultas; os cards
      mostram o total do `/dashboard/` e **não** a soma das linhas (fixture com somas propositalmente
      divergentes); excluir cancelado não chama a API; filtro de tipo manda `?tipo=`.
- [ ] `npm run test && npm run lint && npm run build` verdes.
- [ ] Commit: `feat: build Financeiro page with monthly costs and withdrawals`

### Task 6: Relatório didático e PR

- [ ] `estudos/PR-14-front-financeiro.md`, cobrindo: por que o total vem do `/dashboard/` e não da soma
      das linhas · por que a invalidação de `["dashboard"]` é obrigatória · por que o `exact` do filtro de
      retirada não podia ser removido · por que ordenação sem desempate quebra paginação · por que
      exclusão aqui é hard-delete (e por que isso não contraria a invariante 11).
- [ ] `git push -u origin feat/front-financeiro` + `gh pr create`.

---

## Ordem e dependências

Task 1 (backend) → Task 2 (formato) → Task 3 (tipos/hooks) → Task 4 (forms) → Task 5 (página) → Task 6.
As tasks 2 e 3 são independentes entre si; a 4 depende da 3; a 5 depende de todas.
