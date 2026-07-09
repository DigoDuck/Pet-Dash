# PR 9 · `feat/front-scaffold` — Design doc

> Data: 2026-07-09. Aprovado por Diogo em sessão de brainstorming.
> Fontes: design doc do projeto (`2026-07-02-petdash-plan-design.md`), tokens de `petdash-design-system.jsx` (brand assets locais), API real do backend (PRs 4–7).

## Objetivo

Scaffold do frontend em `frontend/`: app Vite + React + TypeScript + Tailwind v4 com os tokens da marca, componentes base, AppShell com navegação completa do MVP, login com rota protegida consumindo a API JWT real, testes com Vitest/RTL/MSW e job de frontend no CI. Os PRs 10–15 preenchem as páginas sem retocar o shell.

## Decisões desta sessão

| Decisão | Escolha | Racional |
|---|---|---|
| Componentes base | **Híbrido**: feitos à mão com Tailwind agora; Radix pontual só quando precisar de primitivo com a11y complexa (Dialog, Select) nos PRs 12–13 | Button/Badge/Card/Input são simples; entender 100% do código > dependências |
| Armazenamento de tokens JWT | **localStorage para access + refresh** | Single-user, sem conteúdo de terceiros; sessão sobrevive a F5 sem bootstrap extra. Risco de XSS aceito no MVP |
| Tailwind | **v4** (CSS-first, `@theme`, `@tailwindcss/vite`) | Versão atual; sem `tailwind.config.js` |
| AppShell | **Nav completa + rotas stub** desde já | PRs futuros só preenchem páginas; sem diff repetido no shell |
| Arquitetura | **Abordagem A**: estrutura por camada + fetch wrapper próprio (sem axios) | Menos deps; fluxo de auth compreendido de ponta a ponta. Estrutura por features fica para quando doer |
| Linguagem | **TypeScript** | zod + RHF só pagam o custo com `z.infer`; exigência de mercado |

## Dependências

Runtime: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`, `tailwindcss`, `@tailwindcss/vite`.

Dev: `typescript`, `vite`, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `msw`.

MSW é a única adição fora da lista do design doc do projeto: os testes de login/refresh precisam simular respostas HTTP; mockar `fetch` na mão testa o mock, não o código.

## Estrutura

```text
frontend/
  .env.example            # VITE_API_URL=http://localhost:8000/api
  index.html              # Google Fonts: DM Serif Display / Inter / JetBrains Mono
  src/
    components/ui/        # Button, Badge, Card, Input
    components/layout/    # AppShell, Sidebar
    pages/                # Login, Dashboard, Clientes, Servicos,
                          # Atendimentos, Pacotes, Financeiro (stubs), NotFound
    routes/               # ProtectedRoute
    lib/                  # api.ts, auth.ts, queryClient.ts
    styles/index.css      # @theme com tokens da marca
    test/                 # setup.ts, msw/handlers.ts
```

## Camada de auth (núcleo do PR)

Contrato do backend (verificado no código real):

- `POST /api/token/` → `{ "access": ..., "refresh": ... }`; 401 = credencial inválida.
- `POST /api/token/refresh/` → **só** `{ "access": ... }` (`ROTATE_REFRESH_TOKENS` default `False`).
- Access 12h · refresh 7 dias. Endpoints de negócio exigem `Bearer`; `GET /api/health/` é público.

`auth.ts`: lê/grava/limpa `petdash.access` e `petdash.refresh` no localStorage.

`api.ts`: `request(path, init)` injeta `Authorization: Bearer`. Regras do retry:

1. **401 → refresh → refaz a requisição original uma única vez.**
2. **Single-flight**: N chamadas concorrentes com 401 compartilham a mesma `Promise` de refresh (guardada em módulo); sai exatamente um `POST /api/token/refresh/`.
3. **Rotas de auth não disparam refresh**: 401 em `/token/` é senha errada, não sessão expirada (evita loop).
4. **Refresh falhou = logout**: limpa storage e redireciona para `/login`.

Erros de API viram `ApiError { status, detail }`, propagada pelo TanStack Query. `ProtectedRoute` só checa a existência do refresh token (sem decodificar `exp` no cliente; o 401 da API é a fonte de verdade).

## Marca e tokens (Tailwind v4 `@theme`)

Paleta completa do `petdash-design-system.jsx`:

| Token | Hex | | Token | Hex |
|---|---|---|---|---|
| marsala | `#7B2332` | | creme | `#FDF8F0` |
| marsala-light | `#9B3344` | | fundo | `#FAF6F1` |
| marsala-dark | `#5A1A26` | | escuro | `#1C1917` |
| ouro | `#C9A44C` | | escuro-suave | `#2E2926` |
| ouro-light | `#E8D5A0` | | neutro | `#78716C` |
| ouro-muted | `#A8884A` | | neutro-light | `#D6D3D1` |
| sucesso | `#3D7A4A` | | erro | `#B83C3C` |

Proporção 62/28/10 aplicada: sidebar marsala = superfície grande; conteúdo em creme/neutros; ouro só em acentos (badge VIP, item ativo do menu). Logo dourada sempre dentro de container marsala/escuro, nunca em fundo claro. Fontes: DM Serif Display (títulos), Inter (UI), JetBrains Mono (valores monetários).

## Rotas e AppShell

- `/login` pública.
- Layout protegido: `/` (Dashboard), `/clientes`, `/servicos`, `/atendimentos`, `/pacotes`, `/financeiro` + 404.
- Stubs renderizam `<EmConstrucao />`; PRs 10–15 substituem o miolo sem tocar no shell.
- Header exibe **Patricia** (corrige o "Ângelo Duarte" do protótipo Lovable). Protótipo é referência visual estática; estrutura não porta (é TanStack Start).

## Testes e CI

Vitest + RTL + MSW (jsdom):

- `Button`/`Badge`: variantes aplicam as classes esperadas.
- `Login`: sucesso grava tokens e navega; 401 mostra "usuário ou senha inválidos".
- `ProtectedRoute`: sem refresh token → redireciona para `/login`.
- `api.ts`: 401 dispara refresh e refaz a chamada; refresh falho limpa storage; **duas chamadas concorrentes com 401 geram exatamente um POST de refresh** (prova o single-flight).

CI: job `frontend` paralelo ao `backend` em `ci.yml` — `npm ci`, `vitest run`, `npm run build` (o build pega erro de tipo que teste não pega).

## Fora de escopo

Deploy do front na Vercel (fica para a sessão de deploy, junto com o Railway pendente) · páginas reais (PRs 10–15) · agenda visual e demais itens de backlog · dark mode.
