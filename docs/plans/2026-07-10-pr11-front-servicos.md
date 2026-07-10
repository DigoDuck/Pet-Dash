# PR 11 · `feat/front-servicos` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catálogo de serviços — tela `/servicos` com lista, busca, criação e edição em modal, e ativar/desativar via `ativo`, reusando a infra do PR 10.

**Architecture:** 100% frontend; o backend de serviços (PR 5) já atende. Tipos e hooks TanStack em `lib/` e `hooks/`, um `Checkbox` novo em `components/ui/`, um `ServicoForm` com campo créditos condicional, e a página `Servicos`. Nenhuma mudança de model, serializer, view ou migration.

**Tech Stack:** React 19 + TypeScript · TanStack Query v5 · react-hook-form + zod · Vitest + Testing Library + MSW v2.

**Spec:** `docs/specs/2026-07-10-pr11-front-servicos-design.md` (aprovado 2026-07-10).

## Global Constraints

- Branch: `feat/front-servicos` (já criado, a partir de `main` no commit `2e375a4`).
- **Nenhuma mudança no backend.** Sem model, serializer, view ou migration novos. Se `pytest` do backend mudar de resultado, algo está errado.
- Serviço fora do catálogo = `ativo:false` (PATCH), nunca DELETE. A UI não expõe exclusão.
- `creditos` só existe quando `is_pacote=true`; serviço avulso envia `creditos:null` (invariante 3).
- `preco_padrao` é decimal como string ("95.00"), padrão DRF.
- Código, comentários e copy da UI em **português**. Commits em **inglês**, conventional, **sem** trailer de coautoria.
- Contrato da API (verificado): `GET /api/servicos/?search=&is_pacote=&ativo=&ordering=`, resposta `{count, next, previous, results}` (PAGE_SIZE=50); `POST /api/servicos/`; `PATCH /api/servicos/<id>/`. Campos: `id, nome, preco_padrao, is_pacote, creditos, ativo`.
- Componentes reutilizados (já existem): `Button` (primary/secondary/ghost/danger), `Badge` (vip/sucesso/erro/pendente/neutro), `Card`, `Input`, `Modal`, `Paginacao`, `EstadoVazio`, `ErroAoCarregar`, `renderizarComProvedores` (test/utils).
- Comandos, a partir de `frontend/`: `npm run test`, `npm run build`. Backend (verificação final), a partir de `backend/`: `./.venv/Scripts/python.exe -m pytest -q`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `frontend/src/lib/types.ts` | + `Servico`, `ServicoEntrada` |
| `frontend/src/components/ui/Checkbox.tsx` | Label + `<input type="checkbox">` nativo, espelha o `Input` |
| `frontend/src/hooks/useServicos.ts` | Query keys, lista (busca + inativos), criar, atualizar |
| `frontend/src/components/servicos/ServicoForm.tsx` | Form com créditos condicional ao checkbox |
| `frontend/src/pages/Servicos.tsx` | Lista, busca, toggle inativos, modais |

---

### Task 1: `Checkbox` primitivo

**Files:**
- Create: `frontend/src/components/ui/Checkbox.tsx`
- Test: `frontend/src/components/ui/Checkbox.test.tsx`

**Interfaces:**
- Produces: `<Checkbox label error?>` — `ComponentPropsWithRef<"input">` mais `label: string` e `error?: string`. Espalha `...props` para o `register` do react-hook-form funcionar.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/components/ui/Checkbox.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("associa o label ao input e alterna o estado", async () => {
    render(<Checkbox label="É pacote?" />);

    const campo = screen.getByLabelText("É pacote?");
    expect(campo).not.toBeChecked();

    await userEvent.click(campo);

    expect(campo).toBeChecked();
  });

  it("mostra a mensagem de erro com role alert", () => {
    render(<Checkbox label="É pacote?" error="Campo obrigatório" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Campo obrigatório");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- src/components/ui/Checkbox.test.tsx`
Expected: FAIL com `Failed to resolve import "./Checkbox"`

- [ ] **Step 3: Implementar**

Criar `frontend/src/components/ui/Checkbox.tsx`:

```tsx
import { useId, type ComponentPropsWithRef } from "react";

interface CheckboxProps extends ComponentPropsWithRef<"input"> {
  label: string;
  error?: string;
}

export function Checkbox({ label, error, id, className = "", ...props }: CheckboxProps) {
  const gerado = useId();
  const inputId = id ?? props.name ?? gerado;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="flex items-center gap-2 text-sm font-medium text-escuro">
        <input
          id={inputId}
          type="checkbox"
          className={`h-4 w-4 rounded border-neutro-light text-marsala focus:ring-2 focus:ring-marsala/20 ${className}`}
          {...props}
        />
        {label}
      </label>
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

Run: `npm run test -- src/components/ui/Checkbox.test.tsx`
Expected: PASS, 2 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/Checkbox.tsx frontend/src/components/ui/Checkbox.test.tsx
git commit -m "feat: add Checkbox primitive"
```

---

### Task 2: Tipo `Servico` e hooks

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Create: `frontend/src/hooks/useServicos.ts`
- Test: `frontend/src/hooks/useServicos.test.tsx`

**Interfaces:**
- Consumes: `request<T>` de `lib/api.ts`; `Paginated<T>` de `lib/types`.
- Produces:
  - `Servico { id, nome, preco_padrao: string, is_pacote: boolean, creditos: number | null, ativo: boolean }`
  - `ServicoEntrada { nome: string; preco_padrao: string; is_pacote: boolean; creditos: number | null }`
  - `useServicos(busca: string, incluirInativos: boolean)`, `useCriarServico()`, `useAtualizarServico(id: number)` (aceita `Partial<Servico>`)
  - `chavesServicos.raiz = ["servicos"]`

- [ ] **Step 1: Escrever o tipo**

Acrescentar ao fim de `frontend/src/lib/types.ts`:

```ts
export interface Servico {
  id: number;
  nome: string;
  preco_padrao: string;
  is_pacote: boolean;
  creditos: number | null;
  ativo: boolean;
}

export type ServicoEntrada = Pick<
  Servico,
  "nome" | "preco_padrao" | "is_pacote" | "creditos"
>;
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `frontend/src/hooks/useServicos.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { useServicos } from "./useServicos";

const BASE = "http://localhost:8000/api";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useServicos", () => {
  it("filtra por ativo quando não inclui inativos", async () => {
    let url = "";
    server.use(
      http.get(`${BASE}/servicos/`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] });
      }),
    );

    const { result } = renderHook(() => useServicos("", false), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(url).toContain("ativo=true");
  });

  it("omite o filtro ativo quando inclui inativos e envia a busca", async () => {
    let url = "";
    server.use(
      http.get(`${BASE}/servicos/`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] });
      }),
    );

    const { result } = renderHook(() => useServicos("Banho", true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(url).not.toContain("ativo=");
    expect(url).toContain("search=Banho");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm run test -- src/hooks/useServicos.test.tsx`
Expected: FAIL com `Failed to resolve import "./useServicos"`

- [ ] **Step 4: Implementar**

Criar `frontend/src/hooks/useServicos.ts`:

```ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Paginated, Servico, ServicoEntrada } from "../lib/types";

export const chavesServicos = {
  raiz: ["servicos"] as const,
  lista: (busca: string, incluirInativos: boolean) =>
    ["servicos", "lista", busca, incluirInativos] as const,
};

export function useServicos(busca: string, incluirInativos: boolean) {
  const params = new URLSearchParams();
  if (busca) params.set("search", busca);
  // Sem o toggle, a lista mostra só ativos. Ligado, omite o filtro (vêm todos).
  if (!incluirInativos) params.set("ativo", "true");
  return useQuery({
    queryKey: chavesServicos.lista(busca, incluirInativos),
    queryFn: () => request<Paginated<Servico>>(`/servicos/?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useCriarServico() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: ServicoEntrada) =>
      request<Servico>("/servicos/", { method: "POST", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesServicos.raiz }),
  });
}

// PATCH parcial cobre os três casos: editar (objeto do form), desativar
// ({ativo:false}) e reativar ({ativo:true}).
export function useAtualizarServico(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: Partial<Servico>) =>
      request<Servico>(`/servicos/${id}/`, { method: "PATCH", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesServicos.raiz }),
  });
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm run test -- src/hooks/useServicos.test.tsx`
Expected: PASS, 2 passed

Run: `npm run build`
Expected: build sem erro de tipo

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/hooks/useServicos.ts frontend/src/hooks/useServicos.test.tsx
git commit -m "feat: add Servico type and useServicos hooks"
```

---

### Task 3: `ServicoForm` com créditos condicional

**Files:**
- Create: `frontend/src/components/servicos/ServicoForm.tsx`
- Test: `frontend/src/components/servicos/ServicoForm.test.tsx`

**Interfaces:**
- Consumes: `ServicoEntrada` de `lib/types`; `Input`, `Checkbox`, `Button`.
- Produces: `<ServicoForm inicial? aoSalvar enviando aoCancelar />`; `aoSalvar(dados: ServicoEntrada)`. Controlado por quem chama (não conhece mutation nem modal).

**Regra do créditos:** o campo só aparece quando `is_pacote` está marcado (via `watch`). O zod `superRefine` exige `creditos >= 1` quando `is_pacote=true`; quando `false`, o form envia `creditos: null`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/components/servicos/ServicoForm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ServicoForm } from "./ServicoForm";

describe("ServicoForm", () => {
  it("esconde créditos até marcar 'é pacote'", async () => {
    render(<ServicoForm aoSalvar={vi.fn()} enviando={false} aoCancelar={() => {}} />);

    expect(screen.queryByLabelText("Créditos")).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("É pacote?"));

    expect(screen.getByLabelText("Créditos")).toBeInTheDocument();
  });

  it("envia serviço avulso com creditos null", async () => {
    const aoSalvar = vi.fn();
    render(<ServicoForm aoSalvar={aoSalvar} enviando={false} aoCancelar={() => {}} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Banho");
    await userEvent.type(screen.getByLabelText("Preço"), "60.00");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(aoSalvar).toHaveBeenCalledWith({
      nome: "Banho",
      preco_padrao: "60.00",
      is_pacote: false,
      creditos: null,
    });
  });

  it("exige créditos quando é pacote", async () => {
    const aoSalvar = vi.fn();
    render(<ServicoForm aoSalvar={aoSalvar} enviando={false} aoCancelar={() => {}} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Pacote Fidelidade");
    await userEvent.type(screen.getByLabelText("Preço"), "220.00");
    await userEvent.click(screen.getByLabelText("É pacote?"));
    await userEvent.clear(screen.getByLabelText("Créditos"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Pacote precisa de ao menos 1 crédito")).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it("envia pacote com creditos numérico", async () => {
    const aoSalvar = vi.fn();
    render(<ServicoForm aoSalvar={aoSalvar} enviando={false} aoCancelar={() => {}} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Pacote Fidelidade");
    await userEvent.type(screen.getByLabelText("Preço"), "220.00");
    await userEvent.click(screen.getByLabelText("É pacote?"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(aoSalvar).toHaveBeenCalledWith({
      nome: "Pacote Fidelidade",
      preco_padrao: "220.00",
      is_pacote: true,
      creditos: 4,
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- src/components/servicos/ServicoForm.test.tsx`
Expected: FAIL com `Failed to resolve import "./ServicoForm"`

- [ ] **Step 3: Implementar**

Criar `frontend/src/components/servicos/ServicoForm.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { ServicoEntrada } from "../../lib/types";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Input } from "../ui/Input";

const schema = z
  .object({
    nome: z.string().min(1, "Informe o nome"),
    preco_padrao: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Preço inválido (ex.: 60.00)"),
    is_pacote: z.boolean(),
    // String no form; convertida/validada no superRefine.
    creditos: z.string(),
  })
  .superRefine((dados, ctx) => {
    if (dados.is_pacote) {
      const n = Number(dados.creditos);
      if (!Number.isInteger(n) || n < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["creditos"],
          message: "Pacote precisa de ao menos 1 crédito",
        });
      }
    }
  });

type FormData = z.infer<typeof schema>;

interface ServicoFormProps {
  inicial?: ServicoEntrada;
  aoSalvar: (dados: ServicoEntrada) => void;
  enviando: boolean;
  aoCancelar: () => void;
}

export function ServicoForm({ inicial, aoSalvar, enviando, aoCancelar }: ServicoFormProps) {
  const { register, handleSubmit, watch, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: inicial?.nome ?? "",
      preco_padrao: inicial?.preco_padrao ?? "",
      is_pacote: inicial?.is_pacote ?? false,
      creditos: inicial?.creditos != null ? String(inicial.creditos) : "4",
    },
  });

  const ehPacote = watch("is_pacote");

  function enviar(dados: FormData) {
    aoSalvar({
      nome: dados.nome,
      preco_padrao: dados.preco_padrao,
      is_pacote: dados.is_pacote,
      creditos: dados.is_pacote ? Number(dados.creditos) : null,
    });
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4" noValidate>
      <Input label="Nome" error={formState.errors.nome?.message} {...register("nome")} />
      <Input
        label="Preço"
        inputMode="decimal"
        placeholder="60.00"
        error={formState.errors.preco_padrao?.message}
        {...register("preco_padrao")}
      />
      <Checkbox label="É pacote?" {...register("is_pacote")} />
      {ehPacote && (
        <Input
          label="Créditos"
          type="number"
          min={1}
          error={formState.errors.creditos?.message}
          {...register("creditos")}
        />
      )}
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test -- src/components/servicos/ServicoForm.test.tsx`
Expected: PASS, 4 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/servicos/ServicoForm.tsx frontend/src/components/servicos/ServicoForm.test.tsx
git commit -m "feat: add ServicoForm with conditional creditos field"
```

---

### Task 4: Página `Servicos`

**Files:**
- Modify: `frontend/src/pages/Servicos.tsx`
- Test: `frontend/src/pages/Servicos.test.tsx`

**Interfaces:**
- Consumes: `useServicos`, `useCriarServico`, `useAtualizarServico`, `Modal`, `ServicoForm`, `Checkbox`, `Input`, `Button`, `Badge`, `Paginacao`, `EstadoVazio`, `ErroAoCarregar`, `renderizarComProvedores`.
- Produces: rota `/servicos` funcional (já registrada no router pelo PR 9).

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/pages/Servicos.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderizarComProvedores } from "../test/utils";
import { server } from "../test/msw/server";
import { Servicos } from "./Servicos";

const BASE = "http://localhost:8000/api";

afterEach(() => vi.unstubAllGlobals());

function servico(over: Record<string, unknown> = {}) {
  return {
    id: 1, nome: "Banho", preco_padrao: "60.00", is_pacote: false,
    creditos: null, ativo: true, ...over,
  };
}

function paginado(results: unknown[]) {
  return { count: results.length, next: null, previous: null, results };
}

describe("Servicos", () => {
  it("lista os serviços da API", async () => {
    server.use(http.get(`${BASE}/servicos/`, () => HttpResponse.json(paginado([servico()]))));

    renderizarComProvedores(<Servicos />, { rota: "/servicos", caminho: "/servicos" });

    expect(await screen.findByText("Banho")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há serviços", async () => {
    server.use(http.get(`${BASE}/servicos/`, () => HttpResponse.json(paginado([]))));

    renderizarComProvedores(<Servicos />, { rota: "/servicos", caminho: "/servicos" });

    expect(await screen.findByText("Nenhum serviço ainda")).toBeInTheDocument();
  });

  it("o toggle de inativos muda o filtro ativo da query", async () => {
    const filtros: string[] = [];
    server.use(
      http.get(`${BASE}/servicos/`, ({ request }) => {
        filtros.push(new URL(request.url).searchParams.get("ativo") ?? "sem-filtro");
        return HttpResponse.json(paginado([servico()]));
      }),
    );

    renderizarComProvedores(<Servicos />, { rota: "/servicos", caminho: "/servicos" });
    await screen.findByText("Banho");

    await userEvent.click(screen.getByLabelText("Mostrar inativos"));

    await waitFor(() => expect(filtros).toContain("sem-filtro"));
    expect(filtros[0]).toBe("true");
  });

  it("cria um serviço pelo modal e fecha", async () => {
    let criados = 0;
    server.use(
      http.get(`${BASE}/servicos/`, () => HttpResponse.json(paginado([]))),
      http.post(`${BASE}/servicos/`, async () => {
        criados += 1;
        return HttpResponse.json(servico({ id: 9, nome: "Tosa" }), { status: 201 });
      }),
    );

    renderizarComProvedores(<Servicos />, { rota: "/servicos", caminho: "/servicos" });
    await screen.findByText("Nenhum serviço ainda");
    await userEvent.click(screen.getAllByRole("button", { name: "Novo serviço" })[0]);

    await userEvent.type(screen.getByLabelText("Nome"), "Tosa");
    await userEvent.type(screen.getByLabelText("Preço"), "40.00");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(criados).toBe(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("desativa um serviço com PATCH ativo:false", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    let corpo: Record<string, unknown> | null = null;
    server.use(
      http.get(`${BASE}/servicos/`, () => HttpResponse.json(paginado([servico()]))),
      http.patch(`${BASE}/servicos/1/`, async ({ request }) => {
        corpo = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(servico({ ativo: false }));
      }),
    );

    renderizarComProvedores(<Servicos />, { rota: "/servicos", caminho: "/servicos" });
    await screen.findByText("Banho");

    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));

    await waitFor(() => expect(corpo).toEqual({ ativo: false }));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- src/pages/Servicos.test.tsx`
Expected: FAIL. O primeiro teste falha com `Unable to find an element with the text: Banho` (a página ainda renderiza `<EmConstrucao />`).

- [ ] **Step 3: Implementar**

Substituir `frontend/src/pages/Servicos.tsx` por:

```tsx
import { useEffect, useState } from "react";
import { EstadoVazio } from "../components/EstadoVazio";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { ServicoForm } from "../components/servicos/ServicoForm";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Checkbox } from "../components/ui/Checkbox";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Paginacao } from "../components/ui/Paginacao";
import { useAtualizarServico, useCriarServico, useServicos } from "../hooks/useServicos";
import type { Servico } from "../lib/types";

function formatarPreco(valor: string): string {
  return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
}

export function Servicos() {
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Servico | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setBusca(texto);
      setPagina(1);
    }, 300);
    return () => clearTimeout(id);
  }, [texto]);

  const { data, isPending, isError, refetch } = useServicos(busca, incluirInativos);
  const criar = useCriarServico();

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Serviços</h1>
        <Button onClick={() => setCriando(true)}>Novo serviço</Button>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-sm flex-1">
          <Input
            label="Buscar por nome"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Banho, pacote..."
          />
        </div>
        <Checkbox
          label="Mostrar inativos"
          checked={incluirInativos}
          onChange={(e) => {
            setIncluirInativos(e.target.checked);
            setPagina(1);
          }}
        />
      </div>

      <div className="mt-6">
        {isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => refetch()} />
        ) : isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : data.count === 0 ? (
          <EstadoVazio
            titulo={busca ? "Nenhum serviço encontrado" : "Nenhum serviço ainda"}
            descricao={
              busca ? "Tente outro nome." : "Cadastre o primeiro serviço do catálogo."
            }
            acao={busca ? undefined : <Button onClick={() => setCriando(true)}>Novo serviço</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
                    <th className="px-6 py-3 font-semibold">Serviço</th>
                    <th className="px-2 py-3 font-semibold">Tipo</th>
                    <th className="px-2 py-3 font-semibold text-right">Preço</th>
                    <th className="px-6 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((servico) => (
                    <tr
                      key={servico.id}
                      className={`border-t border-neutro-light/60 transition-colors hover:bg-creme/50 ${
                        servico.ativo ? "" : "opacity-50"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <span className="font-medium text-escuro">{servico.nome}</span>
                        {!servico.ativo && (
                          <Badge variant="neutro" className="ml-2">
                            Inativo
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-4">
                        <Badge variant={servico.is_pacote ? "vip" : "pendente"}>
                          {servico.is_pacote ? `Pacote · ${servico.creditos} créditos` : "Avulso"}
                        </Badge>
                      </td>
                      <td className="px-2 py-4 text-right font-mono font-semibold text-escuro">
                        {formatarPreco(servico.preco_padrao)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => setEmEdicao(servico)}>
                            Editar
                          </Button>
                          <AlternarAtivo servico={servico} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} count={data.count} aoMudar={setPagina} />
          </>
        )}
      </div>

      <Modal aberto={criando} titulo="Novo serviço" aoFechar={() => setCriando(false)}>
        <ServicoForm
          enviando={criar.isPending}
          aoCancelar={() => setCriando(false)}
          aoSalvar={(dados) => criar.mutate(dados, { onSuccess: () => setCriando(false) })}
        />
      </Modal>

      {emEdicao && (
        <ModalEdicao servico={emEdicao} aoFechar={() => setEmEdicao(null)} />
      )}
    </div>
  );
}

function AlternarAtivo({ servico }: { servico: Servico }) {
  const atualizar = useAtualizarServico(servico.id);
  if (servico.ativo) {
    return (
      <Button
        variant="danger"
        disabled={atualizar.isPending}
        onClick={() => {
          if (window.confirm("Desativar este serviço? Ele sai do catálogo, mas o histórico fica."))
            atualizar.mutate({ ativo: false });
        }}
      >
        Desativar
      </Button>
    );
  }
  return (
    <Button
      variant="secondary"
      disabled={atualizar.isPending}
      onClick={() => atualizar.mutate({ ativo: true })}
    >
      Reativar
    </Button>
  );
}

function ModalEdicao({ servico, aoFechar }: { servico: Servico; aoFechar: () => void }) {
  const atualizar = useAtualizarServico(servico.id);
  return (
    <Modal aberto titulo="Editar serviço" aoFechar={aoFechar}>
      <ServicoForm
        inicial={{
          nome: servico.nome,
          preco_padrao: servico.preco_padrao,
          is_pacote: servico.is_pacote,
          creditos: servico.creditos,
        }}
        enviando={atualizar.isPending}
        aoCancelar={aoFechar}
        aoSalvar={(dados) => atualizar.mutate(dados, { onSuccess: aoFechar })}
      />
    </Modal>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test -- src/pages/Servicos.test.tsx`
Expected: PASS, 5 passed

Run: `npm run build`
Expected: build sem erro de tipo

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Servicos.tsx frontend/src/pages/Servicos.test.tsx
git commit -m "feat: build Servicos catalog page with activate/deactivate"
```

---

### Task 5: Verificação de ponta a ponta e relatório de estudos

**Files:**
- Create: `estudos/PR-11-front-servicos.md` (pasta não versionada)

**Interfaces:**
- Consumes: tudo. Nenhum código novo.

- [ ] **Step 1: Suíte completa do frontend**

Run (em `frontend/`): `npm run test`
Expected: todos os arquivos de teste passam (os do PR 10 não podem ter regredido)

Run: `npm run build`
Expected: build sem erro de tipo

- [ ] **Step 2: Backend intacto (não foi tocado)**

Run (em `backend/`): `./.venv/Scripts/python.exe -m pytest -q`
Expected: mesmos testes de antes passam (76 passed)

Run: `./.venv/Scripts/python.exe manage.py makemigrations --check --dry-run`
Expected: `No changes detected`

- [ ] **Step 3: Verificação manual contra a API real**

```bash
cd backend && ./.venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000
```

Em outro terminal, `cd frontend && npm run dev`. Abrir `http://localhost:5173/servicos` e conferir:

1. Os 3 serviços do seed aparecem (Banho, Banho e Tosa, Pacote Fidelidade).
2. "Pacote Fidelidade" mostra o badge "Pacote · 4 créditos"; os outros, "Avulso".
3. Novo serviço avulso: o campo Créditos não aparece; salvar adiciona à lista.
4. Novo serviço marcando "É pacote?": o campo Créditos aparece; salvar sem créditos mostra erro.
5. Desativar um serviço: ele fica esmaecido com badge "Inativo" e some ao recarregar (filtro `ativo=true`).
6. Ligar "Mostrar inativos": o desativado reaparece com botão "Reativar".
7. Reativar: volta ao normal.

- [ ] **Step 4: Escrever o relatório didático**

Criar `estudos/PR-11-front-servicos.md` cobrindo, com o "porquê":

1. **Por que ativar/desativar em vez de DELETE.** FK `PROTECT`, hard-delete quebra, e o pricing snapshot (invariante 7) precisa sobreviver.
2. **Um PATCH, três usos.** `useAtualizarServico` cobrindo editar, desativar e reativar por ser parcial.
3. **Campo condicional com `watch`.** Como o react-hook-form reage ao checkbox, e por que o `superRefine` do zod valida cross-field (créditos depende de is_pacote).
4. **String no form, número/null no envio.** Por que o campo créditos é string no formulário (inputs HTML são string) e vira `number | null` na fronteira com a API.
5. **O filtro `ativo` omitido vs `ativo=true`.** Como o toggle vira presença/ausência de query param, e por que omitir traz todos.

- [ ] **Step 5: Commit e abrir o PR**

```bash
git add -A
git commit -m "docs: add PR 11 implementation plan" --allow-empty
git push -u origin feat/front-servicos
gh pr create --base main --title "PR 11: Catálogo de serviços" --body "Implementa docs/specs/2026-07-10-pr11-front-servicos-design.md"
```

`estudos/` está no `.gitignore` e não entra no commit.

---

## Auto-revisão do plano

**Cobertura da spec.** Todas as seções têm task: `Checkbox` (1), `Servico`/hooks (2), `ServicoForm` com créditos condicional (3), página `Servicos` com busca/toggle/CRUD/ativar-desativar (4), verificação + estudos (5). O backend não muda (confirmado na Task 5, Step 2). Os testes listados na spec estão escritos por extenso.

**Placeholders.** Nenhum. Todo passo que muda código traz o código completo.

**Consistência de nomes.** `Servico`, `ServicoEntrada`, `chavesServicos`, `useServicos`, `useCriarServico`, `useAtualizarServico`, `ServicoForm`, `Checkbox`, `AlternarAtivo`, `ModalEdicao`, `incluirInativos`, `aoSalvar`, `aoCancelar`, `enviando` são usados com a mesma grafia em todas as tasks. O `useAtualizarServico(id)` aceita `Partial<Servico>`, o que cobre tanto `ServicoEntrada` (editar) quanto `{ativo}` (toggle) — verificado nas Tasks 2 e 4.

**Ponto de atenção para a execução.** No teste do `ServicoForm` (Task 3), o campo créditos parte de `"4"` como default; o teste "exige créditos quando é pacote" faz `clear` antes de salvar para forçar o vazio. O teste "envia pacote com creditos numérico" não limpa, então usa o default 4. Coerente com o `defaultValues` do form.
