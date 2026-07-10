# PR 9 · `feat/front-scaffold` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold do frontend PetDash — Vite + React + TypeScript + Tailwind v4 com tokens da marca, componentes base, AppShell com nav completa do MVP, login JWT contra a API real e testes Vitest/RTL/MSW, com job de frontend no CI.

**Architecture:** Estrutura por camada (`components/ui`, `components/layout`, `pages`, `routes`, `lib`). Camada HTTP é um fetch wrapper próprio (`lib/api.ts`) com refresh single-flight em 401; storage de tokens isolado em `lib/auth.ts`; navegação pós-logout vive na camada do app (`queryClient` e páginas), nunca no wrapper. Páginas são stubs que os PRs 10–15 substituem sem tocar no shell.

**Tech Stack:** Vite 7 · React 19 · TypeScript · Tailwind v4 (`@tailwindcss/vite`, tokens via `@theme`) · react-router-dom v7 · TanStack Query v5 · react-hook-form + zod · Vitest + Testing Library + MSW v2.

**Spec:** `docs/specs/2026-07-09-pr9-front-scaffold-design.md` (aprovado 2026-07-09).

## Global Constraints

- Branch: `feat/front-scaffold` (já criado). Tudo vive em `frontend/`, exceto a mudança em `.github/workflows/ci.yml`.
- Node >= 20.19 (exigência do Vite 7). Verificar antes de começar.
- Tokens da marca (exatos, sem inventar): marsala `#7B2332` / marsala-light `#9B3344` / marsala-dark `#5A1A26` / ouro `#C9A44C` / ouro-light `#E8D5A0` / ouro-muted `#A8884A` / creme `#FDF8F0` / fundo `#FAF6F1` / escuro `#1C1917` / escuro-suave `#2E2926` / neutro `#78716C` / neutro-light `#D6D3D1` / sucesso `#3D7A4A` / erro `#B83C3C`.
- Fontes: DM Serif Display (títulos) / Inter (UI) / JetBrains Mono (valores monetários), via Google Fonts.
- Contrato da API (verificado no backend real): `POST /api/token/` → `{access, refresh}`; `POST /api/token/refresh/` → **só** `{access}`; 401 em `/token/` = credencial inválida. Base URL: `import.meta.env.VITE_API_URL`, fallback `http://localhost:8000/api`.
- Chaves de localStorage: `petdash.access` e `petdash.refresh`.
- Copy da UI em pt-BR; persona exibida é **Patricia** (nunca "Ângelo Duarte").
- Proibido neste PR: axios, Radix, shadcn/ui, decodificar JWT no cliente, qualquer resquício de Supabase.
- Commits em inglês, conventional (`feat:`, `test:`, `ci:`, `docs:`), **sem** trailer de coautoria.
- Logo dourada sempre dentro de container marsala/escuro, nunca direto em fundo claro.

---

### Task 1: Scaffold Vite + Tailwind v4 + tokens da marca

**Files:**
- Delete: `frontend/README.md` (recriado na Task 8)
- Create: scaffold `create-vite` em `frontend/` (package.json, tsconfig*, vite.config.ts, index.html, src/…)
- Create: `frontend/src/styles/index.css`, `frontend/.env.example`, `frontend/public/logo.png`
- Modify: `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/vite-env.d.ts`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces: classes Tailwind `bg-marsala`, `text-creme`, `bg-fundo`, `font-display`, `font-mono` etc. (uma por token do Global Constraints); `import.meta.env.VITE_API_URL: string | undefined`; `/logo.png` servido pelo Vite.

- [ ] **Step 1: Verificar Node e scaffoldar**

```bash
node --version   # esperado: >= 20.19
rm frontend/README.md
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```

O diretório `frontend/` fica só com o `.gitignore` do repo cobrindo `node_modules`; o template também traz o seu próprio `frontend/.gitignore` — manter.

- [ ] **Step 2: Instalar dependências de runtime**

```bash
cd frontend
npm install react-router-dom @tanstack/react-query react-hook-form zod @hookform/resolvers tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Configurar o plugin do Tailwind no Vite**

Substituir `frontend/vite.config.ts` por:

```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

- [ ] **Step 4: Criar o CSS com os tokens da marca**

Remover o CSS do template e criar `frontend/src/styles/index.css`:

```bash
rm frontend/src/index.css frontend/src/App.css frontend/src/assets/react.svg
```

```css
@import "tailwindcss";

@theme {
  --color-marsala: #7b2332;
  --color-marsala-light: #9b3344;
  --color-marsala-dark: #5a1a26;
  --color-ouro: #c9a44c;
  --color-ouro-light: #e8d5a0;
  --color-ouro-muted: #a8884a;
  --color-creme: #fdf8f0;
  --color-fundo: #faf6f1;
  --color-escuro: #1c1917;
  --color-escuro-suave: #2e2926;
  --color-neutro: #78716c;
  --color-neutro-light: #d6d3d1;
  --color-sucesso: #3d7a4a;
  --color-erro: #b83c3c;

  --font-display: "DM Serif Display", serif;
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

- [ ] **Step 5: index.html com fontes, título e favicon**

Substituir `frontend/index.html` por (e remover `frontend/public/vite.svg`):

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/logo.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <title>PetDash — Ângelo Spa Animal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Copiar a logo (container marsala fica por conta dos componentes que a usam):

```bash
cp "C:/Users/Diogo/Downloads/Brand - Spa Pet/Brand-logo/logo-oficial-transparent.png" frontend/public/logo.png
```

- [ ] **Step 6: main.tsx e App.tsx provisórios (provam os tokens)**

`frontend/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`frontend/src/App.tsx` (descartado na Task 7):

```tsx
export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-fundo">
      <div className="rounded-xl bg-marsala p-8 text-center">
        <img src="/logo.png" alt="Ângelo Spa Animal" className="mx-auto h-20" />
        <h1 className="font-display mt-4 text-3xl text-creme">PetDash</h1>
        <p className="font-mono mt-2 text-sm text-ouro-light">scaffold ok</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: .env.example e tipagem da env**

`frontend/.env.example`:

```bash
VITE_API_URL=http://localhost:8000/api
```

Substituir `frontend/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 8: Verificar build e smoke visual**

```bash
cd frontend && npm run build
```

Esperado: `tsc -b` sem erro de tipo e `vite build` gera `dist/`. Opcional: `npm run dev` e conferir no navegador o card marsala com a logo e "scaffold ok" em ouro.

- [ ] **Step 9: Commit**

```bash
git add frontend
git commit -m "feat: scaffold vite react-ts frontend with brand tokens (tailwind v4)"
```

---

### Task 2: Infraestrutura de testes (Vitest + RTL + MSW)

**Files:**
- Create: `frontend/src/test/setup.ts`, `frontend/src/test/msw/server.ts`, `frontend/src/test/infra.test.ts`
- Modify: `frontend/vite.config.ts`, `frontend/package.json` (scripts)

**Interfaces:**
- Consumes: scaffold da Task 1.
- Produces: `server: SetupServerApi` exportado de `src/test/msw/server.ts` (testes registram handlers com `server.use(...)`); `localStorage` limpo automaticamente entre testes; matchers do jest-dom disponíveis; scripts `npm run test` (vitest run) e `npm run test:watch`.

- [ ] **Step 1: Instalar dependências de teste**

```bash
cd frontend
npm install -D vitest jsdom msw @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: Configurar o Vitest no vite.config.ts**

Substituir `frontend/vite.config.ts` por (o `defineConfig` passa a vir de `vitest/config` para tipar o bloco `test`):

```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

Em `frontend/package.json`, adicionar aos `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Servidor MSW e setup global**

`frontend/src/test/msw/server.ts`:

```ts
import { setupServer } from "msw/node";

export const server = setupServer();
```

`frontend/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});

afterAll(() => server.close());
```

`onUnhandledRequest: "error"` faz qualquer fetch não previsto quebrar o teste — é o que denuncia requisição duplicada de refresh na Task 4.

- [ ] **Step 4: Teste de fumaça da infra**

`frontend/src/test/infra.test.ts`:

```ts
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server";

describe("infra de testes", () => {
  it("MSW intercepta fetch no ambiente de teste", async () => {
    server.use(
      http.get("http://localhost:8000/api/health/", () =>
        HttpResponse.json({ status: "ok" }),
      ),
    );
    const res = await fetch("http://localhost:8000/api/health/");
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 5: Rodar e verificar**

```bash
cd frontend && npm run test
```

Esperado: `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "test: add vitest + rtl + msw test infrastructure"
```

---

### Task 3: `lib/auth.ts` — storage de tokens (TDD)

**Files:**
- Create: `frontend/src/lib/auth.ts`
- Test: `frontend/src/lib/auth.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (usado pelas Tasks 4, 6 e 7):
  - `getAccessToken(): string | null`
  - `getRefreshToken(): string | null`
  - `setTokens(tokens: { access: string; refresh?: string }): void` — sem `refresh`, preserva o existente (caso do endpoint de refresh, que devolve só `access`)
  - `clearTokens(): void`
  - `isAuthenticated(): boolean` — `true` se existe refresh token

- [ ] **Step 1: Escrever os testes que falham**

`frontend/src/lib/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  isAuthenticated,
  setTokens,
} from "./auth";

describe("auth storage", () => {
  it("grava e lê access e refresh", () => {
    setTokens({ access: "a1", refresh: "r1" });
    expect(getAccessToken()).toBe("a1");
    expect(getRefreshToken()).toBe("r1");
  });

  it("setTokens sem refresh preserva o refresh existente", () => {
    setTokens({ access: "a1", refresh: "r1" });
    setTokens({ access: "a2" });
    expect(getAccessToken()).toBe("a2");
    expect(getRefreshToken()).toBe("r1");
  });

  it("clearTokens remove tudo e derruba isAuthenticated", () => {
    setTokens({ access: "a1", refresh: "r1" });
    expect(isAuthenticated()).toBe(true);
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it("sem nada no storage, isAuthenticated é false", () => {
    expect(isAuthenticated()).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd frontend && npx vitest run src/lib/auth.test.ts
```

Esperado: FAIL — módulo `./auth` não existe.

- [ ] **Step 3: Implementar**

`frontend/src/lib/auth.ts`:

```ts
const ACCESS_KEY = "petdash.access";
const REFRESH_KEY = "petdash.refresh";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: { access: string; refresh?: string }): void {
  localStorage.setItem(ACCESS_KEY, tokens.access);
  if (tokens.refresh) {
    localStorage.setItem(REFRESH_KEY, tokens.refresh);
  }
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isAuthenticated(): boolean {
  return getRefreshToken() !== null;
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd frontend && npx vitest run src/lib/auth.test.ts
```

Esperado: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib
git commit -m "feat: add jwt token storage helpers"
```

---

### Task 4: `lib/api.ts` — fetch wrapper com refresh single-flight (TDD)

**Files:**
- Create: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `getAccessToken`, `getRefreshToken`, `setTokens`, `clearTokens` de `./auth` (Task 3).
- Produces (usado pelas Tasks 6 e 7):
  - `class ApiError extends Error { status: number; detail: unknown }`
  - `request<T = unknown>(path: string, init?: RequestInit): Promise<T>` — injeta Bearer; em 401 (fora de `/token/`) faz refresh single-flight e refaz **uma** vez; refresh falho limpa tokens e lança `ApiError(401)` (a navegação para `/login` é responsabilidade de quem consome — ver queryClient na Task 6)
  - `login(username: string, password: string): Promise<void>` — `POST /token/` e grava os dois tokens
  - `logout(): void` — só limpa os tokens

- [ ] **Step 1: Escrever os testes que falham**

`frontend/src/lib/api.test.ts`:

```ts
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { ApiError, login, request } from "./api";
import { getAccessToken, getRefreshToken, setTokens } from "./auth";

const API = "http://localhost:8000/api";

describe("request", () => {
  beforeEach(() => {
    setTokens({ access: "access-velho", refresh: "refresh-ok" });
  });

  it("injeta o Bearer e devolve o JSON", async () => {
    server.use(
      http.get(`${API}/tutores/`, ({ request: req }) => {
        expect(req.headers.get("Authorization")).toBe("Bearer access-velho");
        return HttpResponse.json({ results: [] });
      }),
    );
    await expect(request("/tutores/")).resolves.toEqual({ results: [] });
  });

  it("erro da API vira ApiError com status e detail", async () => {
    server.use(
      http.get(`${API}/tutores/`, () =>
        HttpResponse.json({ detail: "quebrou" }, { status: 500 }),
      ),
    );
    const err = await request("/tutores/").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
    expect((err as ApiError).detail).toEqual({ detail: "quebrou" });
  });

  it("em 401 faz refresh, refaz a chamada e grava o novo access", async () => {
    let chamadas = 0;
    server.use(
      http.get(`${API}/tutores/`, ({ request: req }) => {
        chamadas += 1;
        if (req.headers.get("Authorization") === "Bearer access-novo") {
          return HttpResponse.json({ results: ["ok"] });
        }
        return HttpResponse.json({ detail: "token expirado" }, { status: 401 });
      }),
      http.post(`${API}/token/refresh/`, () =>
        HttpResponse.json({ access: "access-novo" }),
      ),
    );
    await expect(request("/tutores/")).resolves.toEqual({ results: ["ok"] });
    expect(chamadas).toBe(2);
    expect(getAccessToken()).toBe("access-novo");
    expect(getRefreshToken()).toBe("refresh-ok");
  });

  it("duas chamadas concorrentes com 401 disparam um único refresh", async () => {
    let refreshes = 0;
    const protegido = ({ request: req }: { request: Request }) =>
      req.headers.get("Authorization") === "Bearer access-novo"
        ? HttpResponse.json({ ok: true })
        : HttpResponse.json({}, { status: 401 });
    server.use(
      http.get(`${API}/tutores/`, protegido),
      http.get(`${API}/pets/`, protegido),
      http.post(`${API}/token/refresh/`, async () => {
        refreshes += 1;
        await new Promise((r) => setTimeout(r, 20));
        return HttpResponse.json({ access: "access-novo" });
      }),
    );
    await Promise.all([request("/tutores/"), request("/pets/")]);
    expect(refreshes).toBe(1);
  });

  it("refresh falho limpa os tokens e lança ApiError 401", async () => {
    server.use(
      http.get(`${API}/tutores/`, () => HttpResponse.json({}, { status: 401 })),
      http.post(`${API}/token/refresh/`, () =>
        HttpResponse.json({ detail: "refresh expirado" }, { status: 401 }),
      ),
    );
    await expect(request("/tutores/")).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("401 no /token/ não dispara refresh (é senha errada)", async () => {
    let refreshes = 0;
    server.use(
      http.post(`${API}/token/`, () =>
        HttpResponse.json({ detail: "no active account" }, { status: 401 }),
      ),
      http.post(`${API}/token/refresh/`, () => {
        refreshes += 1;
        return HttpResponse.json({ access: "x" });
      }),
    );
    await expect(login("patricia", "senha-errada")).rejects.toBeInstanceOf(ApiError);
    expect(refreshes).toBe(0);
  });
});

describe("login", () => {
  it("grava access e refresh após autenticar", async () => {
    server.use(
      http.post(`${API}/token/`, () =>
        HttpResponse.json({ access: "a1", refresh: "r1" }),
      ),
    );
    await login("patricia", "segredo");
    expect(getAccessToken()).toBe("a1");
    expect(getRefreshToken()).toBe("r1");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd frontend && npx vitest run src/lib/api.test.ts
```

Esperado: FAIL — módulo `./api` não existe.

- [ ] **Step 3: Implementar**

`frontend/src/lib/api.ts`:

```ts
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./auth";

const BASE_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(`Erro ${status} na API`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Single-flight: N chamadas concorrentes com 401 compartilham esta Promise,
// garantindo exatamente um POST /token/refresh/ por expiração.
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const res = await fetch(`${BASE_URL}/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { access: string };
  setTokens({ access: data.access });
  return true;
}

function refreshOnce(): Promise<boolean> {
  refreshPromise ??= tryRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function request<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const doFetch = () => {
    const access = getAccessToken();
    return fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
      },
    });
  };

  let res = await doFetch();

  // 401 em /token/ é credencial inválida, não sessão expirada — sem refresh.
  if (res.status === 401 && !path.startsWith("/token/")) {
    const renovado = await refreshOnce();
    if (!renovado) {
      clearTokens();
      throw new ApiError(401, "Sessão expirada");
    }
    res = await doFetch();
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseBody(res));
  }
  return (await parseBody(res)) as T;
}

export async function login(username: string, password: string): Promise<void> {
  const data = await request<{ access: string; refresh: string }>("/token/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setTokens(data);
}

export function logout(): void {
  clearTokens();
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd frontend && npx vitest run src/lib/api.test.ts
```

Esperado: `7 passed`. O teste de concorrência falharia com `refreshes === 2` se o single-flight não existisse; o `onUnhandledRequest: "error"` do setup pega qualquer requisição fora do previsto.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib
git commit -m "feat: add api client with jwt refresh (single-flight)"
```

---

### Task 5: Componentes base — Button, Badge, Card, Input (TDD)

**Files:**
- Create: `frontend/src/components/ui/Button.tsx`, `Badge.tsx`, `Card.tsx`, `Input.tsx`
- Test: `frontend/src/components/ui/Button.test.tsx`, `Badge.test.tsx`, `Input.test.tsx`

**Interfaces:**
- Consumes: tokens Tailwind da Task 1.
- Produces (usado pelas Tasks 6 e 7):
  - `Button({ variant?: "primary" | "secondary" | "ghost" | "danger", ...ButtonHTMLAttributes })` — default `primary`
  - `Badge({ variant?: "vip" | "sucesso" | "erro" | "pendente" | "neutro", ...HTMLAttributes<HTMLSpanElement> })` — default `neutro`
  - `Card({ ...HTMLAttributes<HTMLDivElement> })`
  - `Input({ label: string, error?: string, ...ComponentPropsWithRef<"input"> })` — associa `<label>` via `id ?? name`; erro renderiza com `role="alert"`; aceita o `ref` do `register` do react-hook-form (React 19: ref como prop)

- [ ] **Step 1: Escrever os testes que falham**

`frontend/src/components/ui/Button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("usa a variante primary (marsala) por padrão", () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveClass("bg-marsala");
  });

  it("aplica a variante secondary (contorno marsala)", () => {
    render(<Button variant="secondary">Cancelar</Button>);
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveClass("border-marsala");
  });

  it("aplica a variante danger (erro)", () => {
    render(<Button variant="danger">Excluir</Button>);
    expect(screen.getByRole("button", { name: "Excluir" })).toHaveClass("bg-erro");
  });

  it("repassa disabled para o elemento nativo", () => {
    render(<Button disabled>Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });
});
```

`frontend/src/components/ui/Badge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("usa a variante neutro por padrão", () => {
    render(<Badge>Avulso</Badge>);
    expect(screen.getByText("Avulso")).toHaveClass("text-neutro");
  });

  it("variante vip usa o acento ouro", () => {
    render(<Badge variant="vip">VIP</Badge>);
    expect(screen.getByText("VIP")).toHaveClass("text-ouro-muted");
  });

  it("variante sucesso usa o verde da marca", () => {
    render(<Badge variant="sucesso">Liberado</Badge>);
    expect(screen.getByText("Liberado")).toHaveClass("text-sucesso");
  });
});
```

`frontend/src/components/ui/Input.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("associa o label ao input pelo name", () => {
    render(<Input label="Usuário" name="username" />);
    expect(screen.getByLabelText("Usuário")).toBeInTheDocument();
  });

  it("mostra a mensagem de erro com role alert", () => {
    render(<Input label="Usuário" name="username" error="Informe o usuário" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o usuário");
    expect(screen.getByLabelText("Usuário")).toHaveAttribute("aria-invalid", "true");
  });

  it("sem erro não renderiza alert", () => {
    render(<Input label="Usuário" name="username" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd frontend && npx vitest run src/components
```

Esperado: FAIL — módulos não existem.

- [ ] **Step 3: Implementar os quatro componentes**

`frontend/src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-marsala text-creme hover:bg-marsala-light",
  secondary: "border border-marsala text-marsala hover:bg-marsala/5",
  ghost: "text-escuro hover:bg-neutro-light/40",
  danger: "bg-erro text-creme hover:bg-erro/90",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ouro disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
```

`frontend/src/components/ui/Badge.tsx`:

```tsx
import type { HTMLAttributes } from "react";

type Variant = "vip" | "sucesso" | "erro" | "pendente" | "neutro";

const variants: Record<Variant, string> = {
  vip: "border border-ouro/40 bg-ouro/15 text-ouro-muted",
  sucesso: "bg-sucesso/10 text-sucesso",
  erro: "bg-erro/10 text-erro",
  pendente: "bg-ouro-light/40 text-escuro-suave",
  neutro: "bg-neutro-light/40 text-neutro",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ variant = "neutro", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
```

`frontend/src/components/ui/Card.tsx`:

```tsx
import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-neutro-light/60 bg-creme p-6 shadow-sm ${className}`}
      {...props}
    />
  );
}
```

`frontend/src/components/ui/Input.tsx`:

```tsx
import type { ComponentPropsWithRef } from "react";

interface InputProps extends ComponentPropsWithRef<"input"> {
  label: string;
  error?: string;
}

export function Input({ label, error, id, className = "", ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-escuro">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={`rounded-lg border bg-white px-3 py-2 text-sm text-escuro transition-colors outline-none placeholder:text-neutro focus:border-marsala focus:ring-2 focus:ring-marsala/20 ${
          error ? "border-erro" : "border-neutro-light"
        } ${className}`}
        {...props}
      />
      {error && (
        <p role="alert" className="text-xs text-erro">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd frontend && npx vitest run src/components
```

Esperado: `10 passed` (4 Button + 3 Badge + 3 Input).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components
git commit -m "feat: add base ui components (button, badge, card, input)"
```

---

### Task 6: Página de Login + queryClient (TDD)

**Files:**
- Create: `frontend/src/pages/Login.tsx`, `frontend/src/lib/queryClient.ts`
- Test: `frontend/src/pages/Login.test.tsx`

**Interfaces:**
- Consumes: `login`, `ApiError` (Task 4); `clearTokens` (Task 3); `Button`, `Card`, `Input` (Task 5).
- Produces: `Login()` (componente de página, rota `/login`); `queryClient: QueryClient` — em erro 401 de query/mutation limpa tokens e redireciona para `/login` (é aqui que mora o "refresh falhou = logout" da spec, não no fetch wrapper).

- [ ] **Step 1: Escrever os testes que falham**

`frontend/src/pages/Login.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { getAccessToken, getRefreshToken } from "../lib/auth";
import { server } from "../test/msw/server";
import { Login } from "./Login";

const API = "http://localhost:8000/api";

function renderLogin() {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <Login /> },
      { path: "/", element: <p>dashboard fake</p> },
    ],
    { initialEntries: ["/login"] },
  );
  render(<RouterProvider router={router} />);
}

describe("Login", () => {
  it("com credenciais válidas grava os tokens e navega para /", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/token/`, () =>
        HttpResponse.json({ access: "a1", refresh: "r1" }),
      ),
    );
    renderLogin();
    await user.type(screen.getByLabelText("Usuário"), "patricia");
    await user.type(screen.getByLabelText("Senha"), "segredo");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("dashboard fake")).toBeInTheDocument();
    expect(getAccessToken()).toBe("a1");
    expect(getRefreshToken()).toBe("r1");
  });

  it("com credencial inválida mostra a mensagem de erro e não navega", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/token/`, () =>
        HttpResponse.json({ detail: "no active account" }, { status: 401 }),
      ),
    );
    renderLogin();
    await user.type(screen.getByLabelText("Usuário"), "patricia");
    await user.type(screen.getByLabelText("Senha"), "errada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Usuário ou senha inválidos",
    );
    expect(getAccessToken()).toBeNull();
  });

  it("campos vazios mostram validação sem chamar a API", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findAllByRole("alert")).toHaveLength(2);
  });
});
```

O terceiro teste só passa sem chamar a API porque o zod barra antes do submit — se chamasse, o `onUnhandledRequest: "error"` derrubaria o teste.

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd frontend && npx vitest run src/pages/Login.test.tsx
```

Esperado: FAIL — módulo `./Login` não existe.

- [ ] **Step 3: Implementar Login e queryClient**

`frontend/src/pages/Login.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { ApiError, login } from "../lib/api";

const schema = z.object({
  username: z.string().min(1, "Informe o usuário"),
  password: z.string().min(1, "Informe a senha"),
});

type FormData = z.infer<typeof schema>;

export function Login() {
  const navigate = useNavigate();
  const [erroApi, setErroApi] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setErroApi(null);
    try {
      await login(data.username, data.password);
      navigate("/");
    } catch (e) {
      setErroApi(
        e instanceof ApiError && e.status === 401
          ? "Usuário ou senha inválidos"
          : "Erro ao conectar. Tente novamente.",
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-fundo p-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex justify-center rounded-lg bg-marsala p-4">
          <img src="/logo.png" alt="Ângelo Spa Animal" className="h-16" />
        </div>
        <h1 className="font-display text-2xl text-escuro">PetDash</h1>
        <p className="mb-6 text-sm text-neutro">Gestão do Ângelo Spa Animal</p>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Input
            label="Usuário"
            autoComplete="username"
            error={formState.errors.username?.message}
            {...register("username")}
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            error={formState.errors.password?.message}
            {...register("password")}
          />
          {erroApi && (
            <p role="alert" className="text-sm text-erro">
              {erroApi}
            </p>
          )}
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
```

`frontend/src/lib/queryClient.ts`:

```ts
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import { clearTokens } from "./auth";

function aoFalharComo401(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    clearTokens();
    window.location.assign("/login");
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: aoFalharComo401 }),
  mutationCache: new MutationCache({ onError: aoFalharComo401 }),
  defaultOptions: {
    queries: {
      // Erro 4xx é determinístico (auth, validação, 404): repetir não ajuda.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
        failureCount < 2,
    },
  },
});
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd frontend && npx vitest run src/pages/Login.test.tsx
```

Esperado: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat: add login page with jwt authentication"
```

---

### Task 7: Rotas protegidas + AppShell + páginas stub

**Files:**
- Create: `frontend/src/routes/ProtectedRoute.tsx`, `frontend/src/routes/router.tsx`
- Create: `frontend/src/components/layout/AppShell.tsx`, `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/components/EmConstrucao.tsx`
- Create: `frontend/src/pages/Dashboard.tsx`, `Clientes.tsx`, `Servicos.tsx`, `Atendimentos.tsx`, `Pacotes.tsx`, `Financeiro.tsx`, `NotFound.tsx`
- Modify: `frontend/src/main.tsx`
- Delete: `frontend/src/App.tsx`
- Test: `frontend/src/routes/ProtectedRoute.test.tsx`

**Interfaces:**
- Consumes: `isAuthenticated`, `setTokens` (Task 3); `logout` (Task 4); `queryClient` (Task 6); `Card` (Task 5); `Login` (Task 6).
- Produces: `router` (createBrowserRouter) com `/login` pública e, sob `ProtectedRoute` + `AppShell`: `/`, `/clientes`, `/servicos`, `/atendimentos`, `/pacotes`, `/financeiro`, `*` (404). PRs 10–15 substituem o miolo de cada página sem tocar no shell.

- [ ] **Step 1: Escrever os testes que falham**

`frontend/src/routes/ProtectedRoute.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { setTokens } from "../lib/auth";
import { ProtectedRoute } from "./ProtectedRoute";

function renderProtegido() {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <p>página de login</p> },
      {
        element: <ProtectedRoute />,
        children: [{ path: "/", element: <p>conteúdo protegido</p> }],
      },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("ProtectedRoute", () => {
  it("sem refresh token redireciona para /login", () => {
    renderProtegido();
    expect(screen.getByText("página de login")).toBeInTheDocument();
    expect(screen.queryByText("conteúdo protegido")).not.toBeInTheDocument();
  });

  it("com refresh token renderiza o conteúdo", () => {
    setTokens({ access: "a", refresh: "r" });
    renderProtegido();
    expect(screen.getByText("conteúdo protegido")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd frontend && npx vitest run src/routes
```

Esperado: FAIL — módulo `./ProtectedRoute` não existe.

- [ ] **Step 3: Implementar ProtectedRoute**

`frontend/src/routes/ProtectedRoute.tsx`:

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated } from "../lib/auth";

export function ProtectedRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd frontend && npx vitest run src/routes
```

Esperado: `2 passed`.

- [ ] **Step 5: Shell, stubs e router**

`frontend/src/components/EmConstrucao.tsx`:

```tsx
import { Card } from "./ui/Card";

export function EmConstrucao({ titulo }: { titulo: string }) {
  return (
    <div>
      <h1 className="font-display text-3xl text-escuro">{titulo}</h1>
      <Card className="mt-6 flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-lg font-medium text-escuro">Em construção</p>
        <p className="text-sm text-neutro">Esta página chega num próximo PR.</p>
      </Card>
    </div>
  );
}
```

`frontend/src/components/layout/Sidebar.tsx`:

```tsx
import { NavLink, useNavigate } from "react-router-dom";
import { logout } from "../../lib/api";

const itens = [
  { to: "/", label: "Dashboard" },
  { to: "/clientes", label: "Clientes & Pets" },
  { to: "/servicos", label: "Serviços" },
  { to: "/atendimentos", label: "Atendimentos" },
  { to: "/pacotes", label: "Pacotes" },
  { to: "/financeiro", label: "Financeiro" },
];

export function Sidebar() {
  const navigate = useNavigate();
  return (
    <aside className="flex w-60 flex-col bg-marsala text-creme">
      <div className="flex items-center gap-3 p-5">
        <img src="/logo.png" alt="" className="h-10" />
        <span className="font-display text-xl">PetDash</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {itens.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-marsala-dark font-medium text-ouro-light"
                  : "text-creme/80 hover:bg-marsala-light/40"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => {
          logout();
          navigate("/login");
        }}
        className="m-3 rounded-lg px-3 py-2 text-left text-sm text-creme/70 transition-colors hover:bg-marsala-light/40"
      >
        Sair
      </button>
    </aside>
  );
}
```

`frontend/src/components/layout/AppShell.tsx`:

```tsx
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-fundo">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-end border-b border-neutro-light/60 bg-creme px-6">
          <div className="text-right">
            <p className="text-sm font-medium text-escuro">Patricia</p>
            <p className="text-xs text-neutro">Ângelo Spa Animal</p>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

Páginas stub — todas com o mesmo formato; criar as sete:

```tsx
// frontend/src/pages/Dashboard.tsx
import { EmConstrucao } from "../components/EmConstrucao";

export function Dashboard() {
  return <EmConstrucao titulo="Dashboard" />;
}
```

```tsx
// frontend/src/pages/Clientes.tsx
import { EmConstrucao } from "../components/EmConstrucao";

export function Clientes() {
  return <EmConstrucao titulo="Clientes & Pets" />;
}
```

```tsx
// frontend/src/pages/Servicos.tsx
import { EmConstrucao } from "../components/EmConstrucao";

export function Servicos() {
  return <EmConstrucao titulo="Serviços" />;
}
```

```tsx
// frontend/src/pages/Atendimentos.tsx
import { EmConstrucao } from "../components/EmConstrucao";

export function Atendimentos() {
  return <EmConstrucao titulo="Atendimentos" />;
}
```

```tsx
// frontend/src/pages/Pacotes.tsx
import { EmConstrucao } from "../components/EmConstrucao";

export function Pacotes() {
  return <EmConstrucao titulo="Pacotes" />;
}
```

```tsx
// frontend/src/pages/Financeiro.tsx
import { EmConstrucao } from "../components/EmConstrucao";

export function Financeiro() {
  return <EmConstrucao titulo="Financeiro" />;
}
```

```tsx
// frontend/src/pages/NotFound.tsx
import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="font-display text-3xl text-escuro">Página não encontrada</h1>
      <Link to="/" className="text-sm text-marsala underline">
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
```

`frontend/src/routes/router.tsx`:

```tsx
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Atendimentos } from "../pages/Atendimentos";
import { Clientes } from "../pages/Clientes";
import { Dashboard } from "../pages/Dashboard";
import { Financeiro } from "../pages/Financeiro";
import { Login } from "../pages/Login";
import { NotFound } from "../pages/NotFound";
import { Pacotes } from "../pages/Pacotes";
import { Servicos } from "../pages/Servicos";
import { ProtectedRoute } from "./ProtectedRoute";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <Dashboard /> },
          { path: "/clientes", element: <Clientes /> },
          { path: "/servicos", element: <Servicos /> },
          { path: "/atendimentos", element: <Atendimentos /> },
          { path: "/pacotes", element: <Pacotes /> },
          { path: "/financeiro", element: <Financeiro /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);
```

Substituir `frontend/src/main.tsx` e apagar o `App.tsx` provisório:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { router } from "./routes/router";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
```

```bash
rm frontend/src/App.tsx
```

- [ ] **Step 6: Suíte completa + build + smoke manual**

```bash
cd frontend && npm run test && npm run build
```

Esperado: todos os testes passando e build limpo. Smoke manual (backend rodando em outra janela com `python manage.py runserver`): `npm run dev`, abrir `http://localhost:5173` → redireciona para `/login`; logar com o superuser local → cai no Dashboard com sidebar marsala, nav completa, header "Patricia"; navegar pelas seções; "Sair" volta ao login.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat: add protected routes and app shell with full mvp nav"
```

---

### Task 8: CI, README, verificação final e PR

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `frontend/README.md` (recriar), `estudos/PR-09-front-scaffold.md` (não versionado)

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: job `frontend` no CI; PR aberto no GitHub.

- [ ] **Step 1: Adicionar o job frontend ao CI**

Em `.github/workflows/ci.yml`, adicionar ao final (mesmo nível do job `backend`):

```yaml
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run test
      # tsc -b roda no build: pega erro de tipo que os testes não pegam
      - run: npm run build
```

- [ ] **Step 2: Recriar o README do frontend**

`frontend/README.md`:

```markdown
# Frontend (React + Vite + Tailwind v4)

App React do PetDash. Consome a API DRF do `backend/` via JWT.

## Rodar local

```bash
npm install
cp .env.example .env   # ajuste VITE_API_URL se a API não estiver em localhost:8000
npm run dev            # http://localhost:5173 (backend precisa estar de pé)
```

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — type-check (`tsc -b`) + build de produção
- `npm run test` — suíte (Vitest + Testing Library + MSW)
- `npm run test:watch` — testes em modo watch

## Convenções

- Tokens da marca em `src/styles/index.css` (bloco `@theme` do Tailwind v4).
- HTTP sempre via `src/lib/api.ts` (injeta JWT e faz refresh em 401); nunca `fetch` direto nas páginas.
- Protótipos do Lovable são só referência visual (sem Supabase, sem portar estrutura). Ver `CLAUDE.md` na raiz.
```

- [ ] **Step 3: Verificação final completa**

```bash
cd frontend && npm run test && npm run build
cd ../backend && ruff check . && pytest -q
```

Esperado: suíte do front verde, build limpo, e a suíte do backend intacta (nada deste PR toca o backend, mas a regra do projeto é rodar antes de fechar).

- [ ] **Step 4: Relatório didático em estudos/**

Criar `estudos/PR-09-front-scaffold.md` (pasta não versionada — sem commit), seguindo o padrão markdownlint-clean dos relatórios anteriores (headers hierárquicos, linha em branco em volta de blocos, fences com linguagem). Conteúdo mínimo: nome do PR; tarefas feitas; justificativa de cada escolha — por que Tailwind v4/`@theme`, por que fetch wrapper próprio em vez de axios (e como funciona o single-flight, com o cenário das N queries concorrentes), por que localStorage e o trade-off de XSS, por que MSW em vez de mockar `fetch`, como o zod + `z.infer` tipa o form do login, e o papel do `tsc -b` no build do CI. Público: dev júnior explicando o código numa entrevista.

- [ ] **Step 5: Push e abertura do PR**

```bash
git push -u origin feat/front-scaffold
gh pr create --title "feat: frontend scaffold (vite + tailwind v4 + login jwt)" --body "$(cat <<'EOF'
## PR 9 — front-scaffold

Scaffold do frontend conforme docs/specs/2026-07-09-pr9-front-scaffold-design.md:

- Vite + React 19 + TypeScript + Tailwind v4 com tokens da marca (@theme)
- Componentes base: Button, Badge, Card, Input (feitos à mão)
- lib/api.ts: fetch wrapper com refresh JWT single-flight em 401
- Login (react-hook-form + zod) + ProtectedRoute + AppShell com nav completa do MVP
- Testes: Vitest + RTL + MSW (auth storage, api client, componentes, login, rota protegida)
- CI: job frontend (npm ci, vitest run, build com tsc -b)

Páginas são stubs "em construção" — PRs 10–15 preenchem sem tocar no shell.
EOF
)"
```

Esperado: CI verde nos dois jobs antes do merge (squash).

---

## Self-Review (feito pós-escrita)

1. **Cobertura do spec:** decisões (híbrido ✓ Task 5 sem Radix; localStorage ✓ Task 3; Tailwind v4 ✓ Task 1; nav completa ✓ Task 7; abordagem A ✓ estrutura e Task 4; TypeScript ✓ template react-ts) · deps ✓ Tasks 1–2 · estrutura ✓ · auth com 4 regras do retry ✓ Task 4 (testes 3–6) · tokens/proporção/logo-em-marsala ✓ Tasks 1, 5–7 · rotas ✓ Task 7 · testes listados no spec ✓ Tasks 4–7 · CI ✓ Task 8. Nota: o redirect pós-falha de refresh mora no `queryClient` (Task 6), não no wrapper — refinamento registrado no spec e no plano.
2. **Placeholders:** nenhum TBD/TODO; todo step de código tem o código completo.
3. **Consistência de tipos:** `setTokens({access, refresh?})` igual nas Tasks 3/4/6/7; `ApiError(status, detail)` igual nas Tasks 4/6; `request<T>(path, init?)` consistente; nomes de componentes e rotas idênticos entre Tasks 5/6/7.
