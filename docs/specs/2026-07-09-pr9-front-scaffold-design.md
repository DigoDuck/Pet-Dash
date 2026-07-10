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
| AppShell | **Nav completa + rotas stub** desde já, com o visual **portado do protótipo Lovable** | PRs futuros só preenchem páginas; sem diff repetido no shell |
| Ícones | **`lucide-react`** (tree-shakeable, só os 7 importados entram no bundle) | É o que o protótipo usa; sidebar só-texto perde a leitura por símbolo no uso diário de balcão |
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

Proporção 62/28/10 aplicada como no protótipo (`src/styles.css` do Lovable): a **sidebar é `escuro` (`#1C1917`)**, não marsala. O marsala aparece em superfícies pequenas e de destaque (tile da logo, avatar, botões primários); creme e neutros seguram o conteúdo; ouro fica só em acentos (item ativo do menu, badge VIP). Logo dourada sempre dentro de container marsala/escuro, nunca em fundo claro. Fontes: DM Serif Display (títulos), Inter (UI), JetBrains Mono (valores monetários).

Mapa dos tokens semânticos do protótipo para os nossos: `--sidebar` → `escuro` · `--sidebar-accent` (item ativo) → `escuro-suave` · `--sidebar-primary` (borda/texto do ativo) → `ouro` · `--primary` (tile da logo) → `marsala`.

## Rotas e AppShell

- `/login` pública.
- Layout protegido: `/` (Painel financeiro), `/clientes`, `/servicos`, `/atendimentos`, `/pacotes`, `/financeiro` + 404.
- Stubs renderizam `<EmConstrucao />`; PRs 10–15 substituem o miolo sem tocar no shell.
- Header exibe **Patricia / Proprietária** (corrige o "Ângelo Duarte" do protótipo). Protótipo é referência **visual**; a estrutura não porta (ele é TanStack Start + shadcn, o repo é Vite + react-router).

Sidebar portada do `app-shell.tsx` do Lovable: superfície escura de 260px, tile marsala com a logo, "PetDash" em ouro sobre subtítulo "Ângelo · Spa Animal", grupos `PRINCIPAL` / `GESTÃO` com micro-rótulos, ícones do `lucide-react`, item ativo em `escuro-suave` com texto ouro e borda direita ouro de 2px. Mais o botão **Sair**, que o protótipo não tem.

O que o protótipo mostra e **não** entra, por estar fora do MVP (ver design doc do projeto): `Agenda` (fase 2), `Relatórios` e `Configurações` (não existem no plano), busca global, sino de notificações e o card "Fechar o mês". Em contrapartida, `Financeiro` (custos e retiradas) existe só no nosso.

## Testes e CI

Vitest + RTL + MSW (jsdom):

- `Button`/`Badge`: variantes aplicam as classes esperadas.
- `Login`: sucesso grava tokens e navega; 401 mostra "usuário ou senha inválidos".
- `ProtectedRoute`: sem refresh token → redireciona para `/login`.
- `api.ts`: 401 dispara refresh e refaz a chamada; refresh falho limpa storage; **duas chamadas concorrentes com 401 geram exatamente um POST de refresh** (prova o single-flight).
- `Sidebar`: lista só os 6 itens do MVP (nenhum dos 3 do protótipo que estão fora); o `end` no NavLink impede que `/` fique ativa nas outras rotas.

A suíte fixa `VITE_API_URL` em `vite.config.ts` (`test.env`). Sem isso, o Vitest carrega o `.env` local do dev e os handlers do MSW deixam de casar — com `onUnhandledRequest: "error"`, a suíte inteira cai. O CI não pegaria, pois lá não existe `.env`.

CI: job `frontend` paralelo ao `backend` em `ci.yml` — `npm ci`, `vitest run`, `npm run build` (o build pega erro de tipo que teste não pega).

## Fora de escopo

Deploy do front na Vercel (fica para a sessão de deploy, junto com o Railway pendente) · páginas reais (PRs 10–15) · agenda visual e demais itens de backlog · dark mode.
