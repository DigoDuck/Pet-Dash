# PR 12 · `feat/front-atendimentos` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar e listar atendimentos — lista com filtros, form em página dedicada com pré-vínculo automático de pacote (mitigação do risco 1: faturar em dobro), combobox de pet com busca, pagamentos dinâmicos e status na lista.

**Architecture:** Uma adição read-only no backend (`pet_nome`/`tutor_nome` no `AtendimentoSerializer`). No frontend: tipos e hooks TanStack, um `Combobox` novo, um `PagamentosField` com `useFieldArray`, o `AtendimentoForm` (núcleo, com o fluxo de pacote) e a página de lista com filtros e ação de status.

**Tech Stack:** Django + DRF · React 19 + TypeScript · TanStack Query v5 · react-hook-form (+ `useFieldArray`, `Controller`) + zod · Vitest + Testing Library + MSW v2.

**Spec:** `docs/specs/2026-07-11-pr12-front-atendimentos-design.md` (aprovado 2026-07-11).

## Global Constraints

- Branch: `feat/front-atendimentos` (já criado, a partir de `main` no commit `540f32b`).
- Backend: só `AtendimentoSerializer` (+2 campos read-only) e `AtendimentoViewSet` (select_related) mudam. **Nenhuma migration.**
- **Vínculo de pacote é o default seguro.** Só vira avulso se: não há pacote, saldo é 0, ou a Patricia clicou "cobrar avulso". Trocar de pet reseta `cobrarAvulso` para `false`.
- Consumo de pacote (`pacote != null`) **não tem pagamentos** (já pago na venda). Avulso pode ter N pagamentos; se houver, `sum(valor) == valor` do atendimento.
- `Atendimento.Status`: `"Liberado"`, `"Pendente"`, `"Cancelado"` (valor = label). Default `Pendente`.
- Métodos de pagamento: `"Pix"`, `"Cartao"`, `"Dinheiro"`.
- Valores decimais são string ("60.00"), padrão DRF. `pet`/`servico`/`pacote` são number|null.
- Código, comentários e copy em **português**. Commits em **inglês**, conventional, **sem** trailer de coautoria.
- Contrato da API (verificado, PR 6): `GET /api/atendimentos/?status=&pet=&data=&page=`; `GET /api/atendimentos/<id>/`; `POST /api/atendimentos/`; `PATCH /api/atendimentos/<id>/`; `GET /api/pets/<id>/pacote-ativo/` (204 se não houver); `GET /api/pets/?search=`; `GET /api/servicos/?ativo=true`. Paginação `{count, next, previous, results}` (PAGE_SIZE=50).
- Componentes reutilizados: `Button`, `Badge`, `Card`, `Input`, `Select`, `Checkbox`, `Modal`, `Paginacao`, `EstadoVazio`, `ErroAoCarregar`, `renderizarComProvedores`. `request<T>` de `lib/api.ts` (devolve `null` em 204).
- Comandos: frontend em `frontend/` (`npm run test`, `npm run build`); backend em `backend/` (`./.venv/Scripts/python.exe -m pytest -q`, `-m ruff check .`).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `backend/core/serializers.py` | `AtendimentoSerializer` + `pet_nome`, `tutor_nome` |
| `backend/core/views.py` | `AtendimentoViewSet` select_related do tutor |
| `frontend/src/lib/types.ts` | + `Pacote`, `AtendimentoEntrada`, `pet_nome`/`tutor_nome` em `Atendimento` |
| `frontend/src/hooks/usePets.ts` | + `useBuscaPets(termo)` |
| `frontend/src/hooks/usePacoteAtivo.ts` | `usePacoteAtivo(petId)` |
| `frontend/src/hooks/useAtendimentos.ts` | + lista, detalhe, criar, atualizar |
| `frontend/src/components/ui/Combobox.tsx` | combobox UI (busca, teclado, ARIA) |
| `frontend/src/components/atendimentos/PagamentosField.tsx` | sub-form dinâmico + soma ao vivo |
| `frontend/src/components/atendimentos/PacoteAtivoBanner.tsx` | banner do pacote vinculado |
| `frontend/src/components/atendimentos/AtendimentoTabela.tsx` | a lista |
| `frontend/src/components/atendimentos/FiltrosAtendimento.tsx` | filtros |
| `frontend/src/components/atendimentos/StatusAcao.tsx` | troca de status na linha |
| `frontend/src/pages/AtendimentoForm.tsx` | form (novo e editar) |
| `frontend/src/pages/Atendimentos.tsx` | lista |
| `frontend/src/routes/router.tsx` | + rotas novo/editar |

---

### Task 1: Backend — `pet_nome` e `tutor_nome`

**Files:**
- Modify: `backend/core/serializers.py`
- Modify: `backend/core/views.py`
- Test: `backend/tests/test_api_atendimentos.py`

**Interfaces:**
- Produces: `GET /api/atendimentos/` devolve `pet_nome: str` e `tutor_nome: str` em cada item, sem N+1.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao fim de `backend/tests/test_api_atendimentos.py`:

```python
def test_lista_atendimentos_traz_pet_e_tutor(api):
    from tests.factories import TutorFactory

    tutor = TutorFactory(nome="Rafael Lima")
    pet = PetFactory(nome="Mel", tutor=tutor)
    AtendimentoFactory(pet=pet, status="Liberado")

    dados = api.get("/api/atendimentos/").json()["results"][0]

    assert dados["pet_nome"] == "Mel"
    assert dados["tutor_nome"] == "Rafael Lima"


def test_lista_atendimentos_sem_n_mais_1(api, django_assert_max_num_queries):
    for _ in range(5):
        AtendimentoFactory(status="Liberado")

    # auth + count + select (com select_related, o join traz pet/tutor/servico/pacote
    # numa query só). Sem o select_related do tutor, seriam ~5 queries extras.
    with django_assert_max_num_queries(6):
        api.get("/api/atendimentos/")
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_api_atendimentos.py::test_lista_atendimentos_traz_pet_e_tutor -v`
Expected: FAIL com `KeyError: 'pet_nome'`

- [ ] **Step 3: Implementar**

Em `backend/core/serializers.py`, no `AtendimentoSerializer`, acrescentar os dois campos e incluí-los em `fields`:

```python
class AtendimentoSerializer(serializers.ModelSerializer):
    pagamentos = PagamentoSerializer(many=True, required=False)
    servico_nome = serializers.CharField(source="servico.nome", read_only=True)
    pet_nome = serializers.CharField(source="pet.nome", read_only=True)
    tutor_nome = serializers.CharField(source="pet.tutor.nome", read_only=True)

    class Meta:
        model = models.Atendimento
        fields = [
            "id", "pet", "pet_nome", "tutor_nome", "servico", "servico_nome",
            "pacote", "data", "horario", "valor", "transporte", "transporte_valor",
            "status", "pagamentos",
        ]
```

O `create`, `update` e `validate` do serializer ficam intactos.

Em `backend/core/views.py`, no `AtendimentoViewSet.get_queryset`, incluir o tutor no `select_related`:

```python
    def get_queryset(self):
        return (
            models.Atendimento.objects.select_related("pet__tutor", "servico", "pacote")
            .prefetch_related("pagamentos")
            .order_by("-data", "-horario")
        )
```

- [ ] **Step 4: Rodar e ver passar**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_api_atendimentos.py -v`
Expected: PASS (todos, incluindo os dois novos)

Run: `./.venv/Scripts/python.exe manage.py makemigrations --check --dry-run`
Expected: `No changes detected`

Run: `./.venv/Scripts/python.exe -m ruff check .`
Expected: `All checks passed!`

- [ ] **Step 5: Commit**

```bash
git add backend/core/serializers.py backend/core/views.py backend/tests/test_api_atendimentos.py
git commit -m "feat: add pet_nome and tutor_nome to AtendimentoSerializer"
```

---

### Task 2: Tipos e hooks

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/hooks/usePets.ts`
- Create: `frontend/src/hooks/usePacoteAtivo.ts`
- Modify: `frontend/src/hooks/useAtendimentos.ts`
- Test: `frontend/src/hooks/usePacoteAtivo.test.tsx`

**Interfaces:**
- Produces:
  - `Pacote { id, pet, servico, competencia, qtd_total, valor_pago, data_compra, validade, saldo }`
  - `AtendimentoEntrada` (payload POST/PATCH)
  - `useBuscaPets(termo: string)` → `Paginated<Pet>` (busca `/pets/?search=`, `enabled` só com termo)
  - `usePacoteAtivo(petId: number | null)` → `Pacote | null`
  - `useAtendimentos(filtros)`, `useAtendimento(id)`, `useCriarAtendimento()`, `useAtualizarAtendimento(id)`

- [ ] **Step 1: Tipos**

Acrescentar ao fim de `frontend/src/lib/types.ts`:

```ts
export interface Pacote {
  id: number;
  pet: number;
  servico: number;
  competencia: string;
  qtd_total: number;
  valor_pago: string;
  data_compra: string;
  validade: string;
  saldo: number;
}

export interface PagamentoEntrada {
  metodo: "Pix" | "Cartao" | "Dinheiro";
  valor: string;
}

export interface AtendimentoEntrada {
  pet: number;
  servico: number;
  pacote: number | null;
  data: string;
  horario: string;
  valor: string;
  transporte: boolean;
  transporte_valor: string;
  status: StatusAtendimento;
  pagamentos: PagamentoEntrada[];
}
```

E acrescentar `pet_nome` e `tutor_nome` à interface `Atendimento` existente (logo após `servico_nome`):

```ts
  servico_nome: string;
  pet_nome: string;
  tutor_nome: string;
```

- [ ] **Step 2: `useBuscaPets` em usePets.ts**

Acrescentar ao fim de `frontend/src/hooks/usePets.ts` (o arquivo já importa `keepPreviousData`? não — ajustar o import da primeira linha para incluí-lo):

Trocar a primeira linha de `usePets.ts`:

```ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
```

Acrescentar a chave e o hook:

```ts
export function useBuscaPets(termo: string) {
  return useQuery({
    queryKey: ["pets", "busca", termo],
    queryFn: () => request<Paginated<Pet>>(`/pets/?search=${encodeURIComponent(termo)}`),
    enabled: termo.length > 0,
    placeholderData: keepPreviousData,
  });
}
```

- [ ] **Step 3: Escrever o teste que falha (usePacoteAtivo)**

Criar `frontend/src/hooks/usePacoteAtivo.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { usePacoteAtivo } from "./usePacoteAtivo";

const BASE = "http://localhost:8000/api";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("usePacoteAtivo", () => {
  it("devolve o pacote quando existe", async () => {
    server.use(
      http.get(`${BASE}/pets/7/pacote-ativo/`, () =>
        HttpResponse.json({
          id: 3, pet: 7, servico: 1, competencia: "2026-07-01", qtd_total: 4,
          valor_pago: "220.00", data_compra: "2026-07-01", validade: "2026-07-31", saldo: 3,
        }),
      ),
    );

    const { result } = renderHook(() => usePacoteAtivo(7), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.saldo).toBe(3);
  });

  it("devolve null quando a API responde 204", async () => {
    server.use(
      http.get(`${BASE}/pets/8/pacote-ativo/`, () => new HttpResponse(null, { status: 204 })),
    );

    const { result } = renderHook(() => usePacoteAtivo(8), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("não busca quando petId é null", () => {
    const { result } = renderHook(() => usePacoteAtivo(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm run test -- src/hooks/usePacoteAtivo.test.tsx`
Expected: FAIL com `Failed to resolve import "./usePacoteAtivo"`

- [ ] **Step 5: Implementar `usePacoteAtivo`**

Criar `frontend/src/hooks/usePacoteAtivo.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Pacote } from "../lib/types";

export function usePacoteAtivo(petId: number | null) {
  return useQuery({
    queryKey: ["pacote-ativo", petId],
    // request<T> devolve null no 204 (pet sem pacote no mês) — o tipo reflete isso.
    queryFn: () => request<Pacote | null>(`/pets/${petId}/pacote-ativo/`),
    enabled: petId != null && petId > 0,
  });
}
```

- [ ] **Step 6: Expandir `useAtendimentos.ts`**

Substituir `frontend/src/hooks/useAtendimentos.ts` por (mantém `useAtendimentosDoPet` do PR 10 e acrescenta o resto):

```ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Atendimento, AtendimentoEntrada, Paginated } from "../lib/types";

export interface FiltrosAtendimento {
  data: string;
  status: string;
  pet: number | null;
  pagina: number;
}

export const chavesAtendimentos = {
  raiz: ["atendimentos"] as const,
  doPet: (petId: number, pagina: number) => ["atendimentos", "doPet", petId, pagina] as const,
  lista: (f: FiltrosAtendimento) =>
    ["atendimentos", "lista", f.data, f.status, f.pet, f.pagina] as const,
  detalhe: (id: number) => ["atendimentos", "detalhe", id] as const,
};

export function useAtendimentosDoPet(petId: number, pagina: number) {
  return useQuery({
    queryKey: chavesAtendimentos.doPet(petId, pagina),
    queryFn: () =>
      request<Paginated<Atendimento>>(`/atendimentos/?pet=${petId}&page=${pagina}`),
    placeholderData: keepPreviousData,
  });
}

export function useAtendimentos(filtros: FiltrosAtendimento) {
  const params = new URLSearchParams({ page: String(filtros.pagina) });
  if (filtros.data) params.set("data", filtros.data);
  if (filtros.status) params.set("status", filtros.status);
  if (filtros.pet != null) params.set("pet", String(filtros.pet));
  return useQuery({
    queryKey: chavesAtendimentos.lista(filtros),
    queryFn: () => request<Paginated<Atendimento>>(`/atendimentos/?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useAtendimento(id: number) {
  return useQuery({
    queryKey: chavesAtendimentos.detalhe(id),
    queryFn: () => request<Atendimento>(`/atendimentos/${id}/`),
    enabled: id > 0,
  });
}

export function useCriarAtendimento() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: AtendimentoEntrada) =>
      request<Atendimento>("/atendimentos/", { method: "POST", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesAtendimentos.raiz }),
  });
}

export function useAtualizarAtendimento(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: Partial<AtendimentoEntrada>) =>
      request<Atendimento>(`/atendimentos/${id}/`, { method: "PATCH", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesAtendimentos.raiz }),
  });
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npm run test -- src/hooks/usePacoteAtivo.test.tsx`
Expected: PASS, 3 passed

Run: `npm run build`
Expected: build sem erro de tipo

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/hooks/usePets.ts frontend/src/hooks/usePacoteAtivo.ts frontend/src/hooks/usePacoteAtivo.test.tsx frontend/src/hooks/useAtendimentos.ts
git commit -m "feat: add Pacote type, usePacoteAtivo and atendimentos list/mutation hooks"
```

---

### Task 3: `Combobox`

**Files:**
- Create: `frontend/src/components/ui/Combobox.tsx`
- Test: `frontend/src/components/ui/Combobox.test.tsx`

**Interfaces:**
- Produces: `<Combobox label itens valor aoSelecionar aoDigitarBusca carregando? placeholder? />`
  - `itens: { id: number; rotulo: string }[]`
  - `valor: { id: number; rotulo: string } | null`
  - `aoSelecionar(item: { id: number; rotulo: string } | null): void`
  - `aoDigitarBusca(termo: string): void`

UI pura: não busca nada, o caller passa `itens` e ouve `aoDigitarBusca`. Teclado: `↓/↑` movem o destaque, `Enter` seleciona, `Esc` fecha; clique fora fecha.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/components/ui/Combobox.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Combobox } from "./Combobox";

const ITENS = [
  { id: 7, rotulo: "Luna · Ana Clara" },
  { id: 8, rotulo: "Thor · Ana Clara" },
];

describe("Combobox", () => {
  it("emite o termo digitado", async () => {
    const aoDigitarBusca = vi.fn();
    render(
      <Combobox label="Pet" itens={[]} valor={null} aoSelecionar={vi.fn()} aoDigitarBusca={aoDigitarBusca} />,
    );

    await userEvent.type(screen.getByLabelText("Pet"), "Lu");

    expect(aoDigitarBusca).toHaveBeenCalledWith("Lu");
  });

  it("seleciona um item pelo clique", async () => {
    const aoSelecionar = vi.fn();
    render(
      <Combobox label="Pet" itens={ITENS} valor={null} aoSelecionar={aoSelecionar} aoDigitarBusca={vi.fn()} />,
    );

    await userEvent.click(screen.getByLabelText("Pet"));
    await userEvent.click(screen.getByText("Luna · Ana Clara"));

    expect(aoSelecionar).toHaveBeenCalledWith({ id: 7, rotulo: "Luna · Ana Clara" });
  });

  it("seleciona com teclado (seta + enter)", async () => {
    const aoSelecionar = vi.fn();
    render(
      <Combobox label="Pet" itens={ITENS} valor={null} aoSelecionar={aoSelecionar} aoDigitarBusca={vi.fn()} />,
    );

    const input = screen.getByLabelText("Pet");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(aoSelecionar).toHaveBeenCalledWith({ id: 8, rotulo: "Thor · Ana Clara" });
  });

  it("mostra o rótulo do valor selecionado", () => {
    render(
      <Combobox
        label="Pet"
        itens={[]}
        valor={{ id: 7, rotulo: "Luna · Ana Clara" }}
        aoSelecionar={vi.fn()}
        aoDigitarBusca={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Pet")).toHaveValue("Luna · Ana Clara");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- src/components/ui/Combobox.test.tsx`
Expected: FAIL com `Failed to resolve import "./Combobox"`

- [ ] **Step 3: Implementar**

Criar `frontend/src/components/ui/Combobox.tsx`:

```tsx
import { useEffect, useId, useRef, useState } from "react";

export interface ItemCombobox {
  id: number;
  rotulo: string;
}

interface ComboboxProps {
  label: string;
  itens: ItemCombobox[];
  valor: ItemCombobox | null;
  aoSelecionar: (item: ItemCombobox | null) => void;
  aoDigitarBusca: (termo: string) => void;
  carregando?: boolean;
  placeholder?: string;
  error?: string;
}

export function Combobox({
  label, itens, valor, aoSelecionar, aoDigitarBusca, carregando, placeholder, error,
}: ComboboxProps) {
  const inputId = useId();
  const listId = useId();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [destaque, setDestaque] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora.
  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  // O input mostra o rótulo selecionado quando fechado; o texto de busca quando aberto.
  const exibido = aberto ? texto : (valor?.rotulo ?? "");

  function selecionar(item: ItemCombobox) {
    aoSelecionar(item);
    setTexto("");
    setAberto(false);
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberto(true);
      setDestaque((d) => Math.min(d + 1, itens.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestaque((d) => Math.max(d - 1, 0));
    } else if (e.key === "Enter" && aberto && itens[destaque]) {
      e.preventDefault();
      selecionar(itens[destaque]);
    } else if (e.key === "Escape") {
      setAberto(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5" ref={raiz}>
      <label htmlFor={inputId} className="text-sm font-medium text-escuro">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={listId}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={exibido}
          onChange={(e) => {
            setTexto(e.target.value);
            setAberto(true);
            setDestaque(0);
            aoDigitarBusca(e.target.value);
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={aoTeclar}
          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-escuro outline-none focus:border-marsala focus:ring-2 focus:ring-marsala/20 ${
            error ? "border-erro" : "border-neutro-light"
          }`}
        />
        {aberto && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-neutro-light bg-white shadow-lg"
          >
            {carregando && <li className="px-3 py-2 text-sm text-neutro">Buscando...</li>}
            {!carregando && itens.length === 0 && (
              <li className="px-3 py-2 text-sm text-neutro">Nenhum pet encontrado</li>
            )}
            {itens.map((item, i) => (
              <li
                key={item.id}
                role="option"
                aria-selected={i === destaque}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selecionar(item);
                }}
                onMouseEnter={() => setDestaque(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  i === destaque ? "bg-marsala/10 text-marsala" : "text-escuro"
                }`}
              >
                {item.rotulo}
              </li>
            ))}
          </ul>
        )}
      </div>
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

Run: `npm run test -- src/components/ui/Combobox.test.tsx`
Expected: PASS, 4 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/Combobox.tsx frontend/src/components/ui/Combobox.test.tsx
git commit -m "feat: add Combobox with search and keyboard navigation"
```

---

### Task 4: `PagamentosField`

**Files:**
- Create: `frontend/src/components/atendimentos/PagamentosField.tsx`
- Test: `frontend/src/components/atendimentos/PagamentosField.test.tsx`

**Interfaces:**
- Consumes: `Control`, `UseFormRegister`, `UseFormWatch` do react-hook-form (tipados sobre o form do atendimento).
- Produces: `<PagamentosField control register watch valorAtendimento />`. Renderiza linhas de `pagamentos` (metodo, valor), botões adicionar/remover, e um resumo ao vivo comparando a soma com `valorAtendimento`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/components/atendimentos/PagamentosField.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import type { AtendimentoEntrada } from "../../lib/types";
import { PagamentosField } from "./PagamentosField";

function Host({ valor }: { valor: string }) {
  // Tipar o form: o control precisa ser Control<AtendimentoEntrada> para casar
  // com o PagamentosField (senão o tsc -b quebra o build — os testes entram no include).
  const { control, register, watch } = useForm<AtendimentoEntrada>({
    defaultValues: { pagamentos: [{ metodo: "Pix", valor: "" }] },
  });
  return (
    <PagamentosField control={control} register={register} watch={watch} valorAtendimento={valor} />
  );
}

describe("PagamentosField", () => {
  it("adiciona e remove linhas de pagamento", async () => {
    render(<Host valor="120.00" />);

    expect(screen.getAllByLabelText("Método")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Adicionar pagamento" }));
    expect(screen.getAllByLabelText("Método")).toHaveLength(2);

    await userEvent.click(screen.getAllByRole("button", { name: "Remover" })[0]);
    expect(screen.getAllByLabelText("Método")).toHaveLength(1);
  });

  it("mostra que a soma confere", async () => {
    render(<Host valor="120.00" />);

    await userEvent.type(screen.getAllByLabelText("Valor")[0], "120.00");

    expect(screen.getByText("Soma confere")).toBeInTheDocument();
  });

  it("mostra quanto falta quando a soma não bate", async () => {
    render(<Host valor="120.00" />);

    await userEvent.type(screen.getAllByLabelText("Valor")[0], "80.00");

    expect(screen.getByText(/falta/i)).toHaveTextContent("Falta R$ 40,00");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- src/components/atendimentos/PagamentosField.test.tsx`
Expected: FAIL com `Failed to resolve import "./PagamentosField"`

- [ ] **Step 3: Implementar**

Criar `frontend/src/components/atendimentos/PagamentosField.tsx`:

```tsx
import { useFieldArray, type Control, type UseFormRegister, type UseFormWatch } from "react-hook-form";
import type { AtendimentoEntrada } from "../../lib/types";
import { Button } from "../ui/Button";

interface PagamentosFieldProps {
  control: Control<AtendimentoEntrada>;
  register: UseFormRegister<AtendimentoEntrada>;
  watch: UseFormWatch<AtendimentoEntrada>;
  valorAtendimento: string;
}

const METODOS = ["Pix", "Cartao", "Dinheiro"] as const;

function formatarReais(n: number): string {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

export function PagamentosField({ control, register, watch, valorAtendimento }: PagamentosFieldProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "pagamentos" });
  const pagamentos = watch("pagamentos") ?? [];

  const soma = pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
  const alvo = Number(valorAtendimento || 0);
  const diferenca = Number((alvo - soma).toFixed(2));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-escuro">Pagamentos</span>
        <Button
          type="button"
          variant="ghost"
          onClick={() => append({ metodo: "Pix", valor: "" })}
        >
          Adicionar pagamento
        </Button>
      </div>

      {fields.map((field, i) => (
        <div key={field.id} className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`pag-metodo-${i}`} className="text-xs font-medium text-neutro">
              Método
            </label>
            <select
              id={`pag-metodo-${i}`}
              className="rounded-lg border border-neutro-light bg-white px-3 py-2 text-sm text-escuro"
              {...register(`pagamentos.${i}.metodo`)}
            >
              {METODOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor={`pag-valor-${i}`} className="text-xs font-medium text-neutro">
              Valor
            </label>
            <input
              id={`pag-valor-${i}`}
              inputMode="decimal"
              placeholder="0.00"
              className="rounded-lg border border-neutro-light bg-white px-3 py-2 text-sm text-escuro"
              {...register(`pagamentos.${i}.valor`)}
            />
          </div>
          <Button type="button" variant="ghost" onClick={() => remove(i)}>
            Remover
          </Button>
        </div>
      ))}

      <div className="text-sm">
        {diferenca === 0 ? (
          <span className="text-sucesso">Soma confere</span>
        ) : diferenca > 0 ? (
          <span className="text-erro">Falta {formatarReais(diferenca)}</span>
        ) : (
          <span className="text-erro">Sobra {formatarReais(-diferenca)}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test -- src/components/atendimentos/PagamentosField.test.tsx`
Expected: PASS, 3 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/atendimentos/PagamentosField.tsx frontend/src/components/atendimentos/PagamentosField.test.tsx
git commit -m "feat: add PagamentosField with dynamic rows and live sum"
```

---

### Task 5: `PacoteAtivoBanner` e `AtendimentoForm` (núcleo)

**Files:**
- Create: `frontend/src/components/atendimentos/PacoteAtivoBanner.tsx`
- Create: `frontend/src/pages/AtendimentoForm.tsx`
- Test: `frontend/src/pages/AtendimentoForm.test.tsx`

**Interfaces:**
- Consumes: `useBuscaPets`, `usePacoteAtivo`, `useServicos`, `useCriarAtendimento`, `useAtualizarAtendimento`, `useAtendimento`, `Combobox`, `PagamentosField`, `Input`, `Select`, `Checkbox`, `Button`.
- Produces: página do form (rotas `/atendimentos/novo` e `/atendimentos/:id/editar`).

**O fluxo de pacote (o coração do PR):** ao escolher o pet, `usePacoteAtivo` busca. Se há pacote com `saldo > 0` e `cobrarAvulso === false`, o form envia `pacote = pacote.id`, mostra o banner e esconde os pagamentos. Trocar de pet reseta `cobrarAvulso`.

- [ ] **Step 1: Escrever o `PacoteAtivoBanner`**

Criar `frontend/src/components/atendimentos/PacoteAtivoBanner.tsx`:

```tsx
import type { Pacote } from "../../lib/types";

interface PacoteAtivoBannerProps {
  pacote: Pacote;
  aoCobrarAvulso: () => void;
}

export function PacoteAtivoBanner({ pacote, aoCobrarAvulso }: PacoteAtivoBannerProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-ouro/40 bg-ouro/10 p-4">
      <div className="text-sm">
        <p className="font-medium text-escuro">Pacote Fidelidade vinculado</p>
        <p className="text-neutro">
          Saldo {pacote.saldo}/{pacote.qtd_total} · este atendimento consome 1 crédito
        </p>
      </div>
      <button
        type="button"
        onClick={aoCobrarAvulso}
        className="shrink-0 text-sm font-medium text-marsala hover:underline"
      >
        Cobrar como avulso
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Escrever o teste que falha (AtendimentoForm)**

Criar `frontend/src/pages/AtendimentoForm.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { renderizarComProvedores } from "../test/utils";
import { server } from "../test/msw/server";
import { AtendimentoForm } from "./AtendimentoForm";

const BASE = "http://localhost:8000/api";

function servicosOk() {
  return http.get(`${BASE}/servicos/`, () =>
    HttpResponse.json({
      count: 1, next: null, previous: null,
      results: [{ id: 1, nome: "Banho", preco_padrao: "60.00", is_pacote: false, creditos: null, ativo: true }],
    }),
  );
}

function petsOk() {
  return http.get(`${BASE}/pets/`, () =>
    HttpResponse.json({
      count: 1, next: null, previous: null,
      results: [{
        id: 7, tutor: 1, tutor_nome: "Ana Clara", nome: "Luna", raca: "", porte: "",
        ativo: true, created_at: "", vip: false, qtd_visitas: 0, total_gasto: "0.00",
      }],
    }),
  );
}

async function escolherLuna() {
  await userEvent.type(screen.getByLabelText("Pet"), "Luna");
  await waitFor(() => expect(screen.getByText("Luna · Ana Clara")).toBeInTheDocument());
  await userEvent.click(screen.getByText("Luna · Ana Clara"));
}

describe("AtendimentoForm", () => {
  it("escolher serviço pré-preenche o valor com o preço de referência", async () => {
    server.use(servicosOk(), petsOk());

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });

    // Esperar a option carregar via MSW antes de selecionar (senão "value not found").
    await screen.findByRole("option", { name: "Banho" });
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "1");

    await waitFor(() => expect(screen.getByLabelText("Valor")).toHaveValue("60.00"));
  });

  it("pet com pacote vincula e esconde os pagamentos", async () => {
    server.use(
      servicosOk(),
      petsOk(),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () =>
        HttpResponse.json({
          id: 3, pet: 7, servico: 1, competencia: "2026-07-01", qtd_total: 4,
          valor_pago: "220.00", data_compra: "2026-07-01", validade: "2026-07-31", saldo: 3,
        }),
      ),
    );

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await escolherLuna();

    expect(await screen.findByText("Pacote Fidelidade vinculado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar pagamento" })).not.toBeInTheDocument();
  });

  it("'cobrar como avulso' desvincula e revela os pagamentos", async () => {
    server.use(
      servicosOk(),
      petsOk(),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () =>
        HttpResponse.json({
          id: 3, pet: 7, servico: 1, competencia: "2026-07-01", qtd_total: 4,
          valor_pago: "220.00", data_compra: "2026-07-01", validade: "2026-07-31", saldo: 3,
        }),
      ),
    );

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await escolherLuna();
    await screen.findByText("Pacote Fidelidade vinculado");

    await userEvent.click(screen.getByRole("button", { name: "Cobrar como avulso" }));

    expect(screen.getByRole("button", { name: "Adicionar pagamento" })).toBeInTheDocument();
    expect(screen.queryByText("Pacote Fidelidade vinculado")).not.toBeInTheDocument();
  });

  it("pet com pacote saldo 0 cai em avulso com aviso", async () => {
    server.use(
      servicosOk(),
      petsOk(),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () =>
        HttpResponse.json({
          id: 3, pet: 7, servico: 1, competencia: "2026-07-01", qtd_total: 4,
          valor_pago: "220.00", data_compra: "2026-07-01", validade: "2026-07-31", saldo: 0,
        }),
      ),
    );

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await escolherLuna();

    expect(await screen.findByText(/sem saldo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar pagamento" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm run test -- src/pages/AtendimentoForm.test.tsx`
Expected: FAIL com `Failed to resolve import "./AtendimentoForm"`

- [ ] **Step 4: Implementar `AtendimentoForm`**

Criar `frontend/src/pages/AtendimentoForm.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { PacoteAtivoBanner } from "../components/atendimentos/PacoteAtivoBanner";
import { PagamentosField } from "../components/atendimentos/PagamentosField";
import { Button } from "../components/ui/Button";
import { Checkbox } from "../components/ui/Checkbox";
import { Combobox } from "../components/ui/Combobox";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import {
  useAtendimento,
  useAtualizarAtendimento,
  useCriarAtendimento,
} from "../hooks/useAtendimentos";
import { usePacoteAtivo } from "../hooks/usePacoteAtivo";
import { useBuscaPets } from "../hooks/usePets";
import { useServicos } from "../hooks/useServicos";
import type { AtendimentoEntrada } from "../lib/types";

const VAZIO: AtendimentoEntrada = {
  pet: 0, servico: 0, pacote: null, data: "", horario: "", valor: "",
  transporte: false, transporte_valor: "0.00", status: "Pendente", pagamentos: [],
};

export function AtendimentoForm() {
  const { id } = useParams();
  const editando = id != null;
  const navigate = useNavigate();

  const [textoPet, setTextoPet] = useState("");
  const [termoPet, setTermoPet] = useState("");
  const [petSelecionado, setPetSelecionado] = useState<{ id: number; rotulo: string } | null>(null);
  const [cobrarAvulso, setCobrarAvulso] = useState(false);

  // Debounce da busca de pet (300ms), como em Clientes/Servicos: sem isto cada
  // tecla dispara um GET /pets/?search=.
  useEffect(() => {
    const t = setTimeout(() => setTermoPet(textoPet), 300);
    return () => clearTimeout(t);
  }, [textoPet]);

  const buscaPets = useBuscaPets(termoPet);
  const pacoteAtivo = usePacoteAtivo(petSelecionado?.id ?? null);
  const servicos = useServicos("", false);
  const criar = useCriarAtendimento();
  const existente = useAtendimento(editando ? Number(id) : 0);
  const atualizar = useAtualizarAtendimento(editando ? Number(id) : 0);

  const { register, handleSubmit, control, watch, setValue, reset, formState } =
    useForm<AtendimentoEntrada>({ defaultValues: VAZIO });

  // Preenche o form ao editar.
  useEffect(() => {
    if (existente.data) {
      reset({ ...existente.data, pagamentos: existente.data.pagamentos.map((p) => ({ metodo: p.metodo, valor: p.valor })) });
      setPetSelecionado({ id: existente.data.pet, rotulo: existente.data.pet_nome });
    }
  }, [existente.data, reset]);

  const pacote = pacoteAtivo.data ?? null;
  const temSaldo = pacote != null && pacote.saldo > 0;
  const usaPacote = temSaldo && !cobrarAvulso;
  const transporte = watch("transporte");
  const valorAtual = watch("valor");
  const servicoAtual = watch("servico");
  const listaServicos = servicos.data?.results ?? [];

  // Ao escolher o serviço, sugere o preço de referência (editável).
  useEffect(() => {
    const s = listaServicos.find((x) => x.id === Number(servicoAtual));
    if (s) setValue("valor", s.preco_padrao);
  }, [servicoAtual]); // eslint-disable-line react-hooks/exhaustive-deps

  function escolherPet(item: { id: number; rotulo: string } | null) {
    setPetSelecionado(item);
    setCobrarAvulso(false); // novo pet volta ao default seguro
    setValue("pet", item?.id ?? 0);
  }

  function enviar(dados: AtendimentoEntrada) {
    const payload: AtendimentoEntrada = {
      ...dados,
      pet: petSelecionado?.id ?? 0,
      pacote: usaPacote ? pacote!.id : null,
      pagamentos: usaPacote ? [] : dados.pagamentos,
    };
    if (editando) {
      atualizar.mutate(payload, { onSuccess: () => navigate("/atendimentos") });
    } else {
      criar.mutate(payload, { onSuccess: () => navigate("/atendimentos") });
    }
  }

  const itensPet =
    buscaPets.data?.results.map((p) => ({ id: p.id, rotulo: `${p.nome} · ${p.tutor_nome}` })) ?? [];

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl text-escuro">
        {editando ? "Editar atendimento" : "Novo atendimento"}
      </h1>

      <form onSubmit={handleSubmit(enviar)} className="mt-6 flex flex-col gap-4" noValidate>
        <Controller
          control={control}
          name="pet"
          rules={{ validate: () => petSelecionado != null || "Escolha um pet" }}
          render={() => (
            <Combobox
              label="Pet"
              itens={itensPet}
              valor={petSelecionado}
              carregando={buscaPets.isFetching}
              placeholder="Buscar por nome do pet ou tutor"
              aoDigitarBusca={setTextoPet}
              aoSelecionar={escolherPet}
              error={formState.errors.pet?.message}
            />
          )}
        />

        {petSelecionado && usaPacote && pacote && (
          <PacoteAtivoBanner pacote={pacote} aoCobrarAvulso={() => setCobrarAvulso(true)} />
        )}
        {petSelecionado && pacote != null && pacote.saldo === 0 && (
          <p className="text-sm text-erro">Pacote sem saldo neste mês; cobrando como avulso.</p>
        )}

        <Select label="Serviço" {...register("servico")}>
          <option value="0">Selecione...</option>
          {listaServicos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Data" type="date" {...register("data")} />
          <Input label="Horário" type="time" {...register("horario")} />
        </div>

        {/* Sem value= explícito: o register controla o input via ref. O
            setValue no effect do serviço atualiza o valor exibido. */}
        <Input label="Valor" inputMode="decimal" {...register("valor")} />

        <Checkbox label="Leva e traz (transporte)" {...register("transporte")} />
        {transporte && (
          <Input label="Valor do transporte" inputMode="decimal" {...register("transporte_valor")} />
        )}

        <Select label="Status" {...register("status")}>
          <option value="Pendente">Pendente</option>
          <option value="Liberado">Liberado</option>
          <option value="Cancelado">Cancelado</option>
        </Select>

        {!usaPacote && (
          <PagamentosField
            control={control}
            register={register}
            watch={watch}
            valorAtendimento={valorAtual}
          />
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate("/atendimentos")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={criar.isPending || atualizar.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm run test -- src/pages/AtendimentoForm.test.tsx`
Expected: PASS, 4 passed

Run: `npm run build`
Expected: build sem erro de tipo

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/atendimentos/PacoteAtivoBanner.tsx frontend/src/pages/AtendimentoForm.tsx frontend/src/pages/AtendimentoForm.test.tsx
git commit -m "feat: build AtendimentoForm with automatic package linking"
```

---

### Task 6: Lista, filtros, status e rotas

**Files:**
- Create: `frontend/src/components/atendimentos/AtendimentoTabela.tsx`
- Create: `frontend/src/components/atendimentos/StatusAcao.tsx`
- Create: `frontend/src/components/atendimentos/FiltrosAtendimento.tsx`
- Modify: `frontend/src/pages/Atendimentos.tsx`
- Modify: `frontend/src/routes/router.tsx`
- Test: `frontend/src/pages/Atendimentos.test.tsx`

**Interfaces:**
- Consumes: `useAtendimentos`, `useAtualizarAtendimento`, `Combobox`, `Select`, `Input`, `Badge`, `Paginacao`, `EstadoVazio`, `ErroAoCarregar`.
- Produces: rotas `/atendimentos`, `/atendimentos/novo`, `/atendimentos/:id/editar`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/pages/Atendimentos.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderizarComProvedores } from "../test/utils";
import { server } from "../test/msw/server";
import { Atendimentos } from "./Atendimentos";

const BASE = "http://localhost:8000/api";

afterEach(() => vi.unstubAllGlobals());

function atendimento(over: Record<string, unknown> = {}) {
  return {
    id: 1, pet: 7, pet_nome: "Luna", tutor_nome: "Ana Clara", servico: 1, servico_nome: "Banho",
    pacote: null, data: "2026-07-08", horario: "10:00:00", valor: "60.00",
    transporte: false, transporte_valor: "0.00", status: "Pendente", pagamentos: [], ...over,
  };
}

function paginado(results: unknown[]) {
  return { count: results.length, next: null, previous: null, results };
}

describe("Atendimentos", () => {
  it("lista os atendimentos com pet e tutor", async () => {
    server.use(http.get(`${BASE}/atendimentos/`, () => HttpResponse.json(paginado([atendimento()]))));

    renderizarComProvedores(<Atendimentos />, { rota: "/atendimentos", caminho: "/atendimentos" });

    expect(await screen.findByText("Luna")).toBeInTheDocument();
    expect(screen.getByText("Ana Clara")).toBeInTheDocument();
  });

  it("filtra por status", async () => {
    const statuses: string[] = [];
    server.use(
      http.get(`${BASE}/atendimentos/`, ({ request }) => {
        statuses.push(new URL(request.url).searchParams.get("status") ?? "");
        return HttpResponse.json(paginado([atendimento()]));
      }),
    );

    renderizarComProvedores(<Atendimentos />, { rota: "/atendimentos", caminho: "/atendimentos" });
    await screen.findByText("Luna");

    await userEvent.selectOptions(screen.getByLabelText("Status"), "Liberado");

    await waitFor(() => expect(statuses).toContain("Liberado"));
  });

  it("marca como liberado pela ação da linha", async () => {
    let corpo: Record<string, unknown> | null = null;
    server.use(
      http.get(`${BASE}/atendimentos/`, () => HttpResponse.json(paginado([atendimento()]))),
      http.patch(`${BASE}/atendimentos/1/`, async ({ request }) => {
        corpo = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(atendimento({ status: "Liberado" }));
      }),
    );

    renderizarComProvedores(<Atendimentos />, { rota: "/atendimentos", caminho: "/atendimentos" });
    await screen.findByText("Luna");

    await userEvent.click(screen.getByRole("button", { name: "Liberar" }));

    await waitFor(() => expect(corpo).toEqual({ status: "Liberado" }));
  });

  it("cancelar pede confirmação", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    let corpo: Record<string, unknown> | null = null;
    server.use(
      http.get(`${BASE}/atendimentos/`, () => HttpResponse.json(paginado([atendimento()]))),
      http.patch(`${BASE}/atendimentos/1/`, async ({ request }) => {
        corpo = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(atendimento({ status: "Cancelado" }));
      }),
    );

    renderizarComProvedores(<Atendimentos />, { rota: "/atendimentos", caminho: "/atendimentos" });
    await screen.findByText("Luna");

    await userEvent.click(screen.getByRole("button", { name: "Cancelar atendimento" }));

    await waitFor(() => expect(corpo).toEqual({ status: "Cancelado" }));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- src/pages/Atendimentos.test.tsx`
Expected: FAIL. O primeiro teste falha com `Unable to find an element with the text: Luna` (ainda é `<EmConstrucao />`).

- [ ] **Step 3: Implementar `StatusAcao`**

Criar `frontend/src/components/atendimentos/StatusAcao.tsx`:

```tsx
import type { Atendimento } from "../../lib/types";
import { useAtualizarAtendimento } from "../../hooks/useAtendimentos";
import { Button } from "../ui/Button";

export function StatusAcao({ atendimento }: { atendimento: Atendimento }) {
  const atualizar = useAtualizarAtendimento(atendimento.id);

  function mudar(status: "Liberado" | "Cancelado") {
    if (status === "Cancelado" && !window.confirm("Cancelar este atendimento? O crédito volta ao pacote, se houver.")) {
      return;
    }
    atualizar.mutate({ status });
  }

  if (atendimento.status === "Cancelado") {
    return <span className="text-xs text-neutro">—</span>;
  }

  return (
    <div className="flex justify-end gap-2">
      {atendimento.status === "Pendente" && (
        <Button variant="secondary" disabled={atualizar.isPending} onClick={() => mudar("Liberado")}>
          Liberar
        </Button>
      )}
      <Button variant="danger" disabled={atualizar.isPending} onClick={() => mudar("Cancelado")}>
        Cancelar atendimento
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Implementar `AtendimentoTabela`**

Criar `frontend/src/components/atendimentos/AtendimentoTabela.tsx`:

```tsx
import { Link } from "react-router-dom";
import type { Atendimento, StatusAtendimento } from "../../lib/types";
import { Badge } from "../ui/Badge";
import { StatusAcao } from "./StatusAcao";

const VARIANTE_STATUS: Record<StatusAtendimento, "sucesso" | "pendente" | "erro"> = {
  Liberado: "sucesso",
  Pendente: "pendente",
  Cancelado: "erro",
};

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarValor(valor: string): string {
  return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
}

export function AtendimentoTabela({ atendimentos }: { atendimentos: Atendimento[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
            <th className="px-6 py-3 font-semibold">Data</th>
            <th className="px-2 py-3 font-semibold">Pet / Tutor</th>
            <th className="px-2 py-3 font-semibold">Serviço</th>
            <th className="px-2 py-3 font-semibold">Origem</th>
            <th className="px-2 py-3 font-semibold">Status</th>
            <th className="px-2 py-3 text-right font-semibold">Valor</th>
            <th className="px-6 py-3 text-right font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody>
          {atendimentos.map((a) => (
            <tr key={a.id} className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50">
              <td className="px-6 py-4">
                <div className="font-mono font-semibold text-escuro">{formatarData(a.data)}</div>
                <div className="font-mono text-xs text-neutro">{a.horario.slice(0, 5)}</div>
              </td>
              <td className="px-2 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutro-light/40 font-semibold text-escuro">
                    {a.pet_nome.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className="font-medium text-escuro">{a.pet_nome}</div>
                    <div className="text-xs text-neutro">{a.tutor_nome}</div>
                  </div>
                </div>
              </td>
              <td className="px-2 py-4 text-escuro">{a.servico_nome}</td>
              <td className="px-2 py-4">
                <Badge variant={a.pacote !== null ? "neutro" : "pendente"}>
                  {a.pacote !== null ? "Pacote" : "Avulso"}
                </Badge>
              </td>
              <td className="px-2 py-4">
                <Badge variant={VARIANTE_STATUS[a.status]}>{a.status}</Badge>
              </td>
              <td className="px-2 py-4 text-right font-mono font-semibold text-escuro">
                {formatarValor(a.valor)}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2">
                  <Link to={`/atendimentos/${a.id}/editar`} className="text-sm font-medium text-marsala hover:underline">
                    Editar
                  </Link>
                  <StatusAcao atendimento={a} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Implementar `FiltrosAtendimento`**

Criar `frontend/src/components/atendimentos/FiltrosAtendimento.tsx`:

```tsx
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

interface FiltrosProps {
  data: string;
  status: string;
  aoMudarData: (v: string) => void;
  aoMudarStatus: (v: string) => void;
}

export function FiltrosAtendimento({ data, status, aoMudarData, aoMudarStatus }: FiltrosProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="w-44">
        <Input label="Data" type="date" value={data} onChange={(e) => aoMudarData(e.target.value)} />
      </div>
      <div className="w-44">
        <Select label="Status" value={status} onChange={(e) => aoMudarStatus(e.target.value)}>
          <option value="">Todos</option>
          <option value="Pendente">Pendente</option>
          <option value="Liberado">Liberado</option>
          <option value="Cancelado">Cancelado</option>
        </Select>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Implementar a página `Atendimentos`**

Substituir `frontend/src/pages/Atendimentos.tsx` por:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AtendimentoTabela } from "../components/atendimentos/AtendimentoTabela";
import { FiltrosAtendimento } from "../components/atendimentos/FiltrosAtendimento";
import { EstadoVazio } from "../components/EstadoVazio";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { Button } from "../components/ui/Button";
import { Paginacao } from "../components/ui/Paginacao";
import { useAtendimentos } from "../hooks/useAtendimentos";

export function Atendimentos() {
  const navigate = useNavigate();
  const [data, setData] = useState("");
  const [status, setStatus] = useState("");
  const [pagina, setPagina] = useState(1);

  const { data: resp, isPending, isError, refetch } = useAtendimentos({
    data, status, pet: null, pagina,
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Atendimentos</h1>
        <Button onClick={() => navigate("/atendimentos/novo")}>Novo atendimento</Button>
      </div>

      <div className="mt-6">
        <FiltrosAtendimento
          data={data}
          status={status}
          aoMudarData={(v) => { setData(v); setPagina(1); }}
          aoMudarStatus={(v) => { setStatus(v); setPagina(1); }}
        />
      </div>

      <div className="mt-6">
        {isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => refetch()} />
        ) : isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : resp.count === 0 ? (
          <EstadoVazio
            titulo="Nenhum atendimento"
            descricao="Registre o primeiro atendimento ou ajuste os filtros."
            acao={<Button onClick={() => navigate("/atendimentos/novo")}>Novo atendimento</Button>}
          />
        ) : (
          <>
            <AtendimentoTabela atendimentos={resp.results} />
            <Paginacao pagina={pagina} count={resp.count} aoMudar={setPagina} />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Rotas**

Em `frontend/src/routes/router.tsx`, acrescentar o import:

```tsx
import { AtendimentoForm } from "../pages/AtendimentoForm";
```

e, dentro do array `children` do `AppShell`, logo abaixo de `{ path: "/atendimentos", element: <Atendimentos /> }`:

```tsx
          { path: "/atendimentos/novo", element: <AtendimentoForm /> },
          { path: "/atendimentos/:id/editar", element: <AtendimentoForm /> },
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npm run test -- src/pages/Atendimentos.test.tsx`
Expected: PASS, 4 passed

Run: `npm run build`
Expected: build sem erro de tipo

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/atendimentos/AtendimentoTabela.tsx frontend/src/components/atendimentos/StatusAcao.tsx frontend/src/components/atendimentos/FiltrosAtendimento.tsx frontend/src/pages/Atendimentos.tsx frontend/src/routes/router.tsx frontend/src/pages/Atendimentos.test.tsx
git commit -m "feat: build Atendimentos list with filters and status actions"
```

---

### Task 7: Verificação de ponta a ponta e relatório de estudos

**Files:**
- Create: `estudos/PR-12-front-atendimentos.md` (não versionado)

- [ ] **Step 1: Suíte completa do backend**

Run (em `backend/`): `./.venv/Scripts/python.exe -m pytest -q`
Expected: todos passam (os testes de faturamento/pacote não regridem)

Run: `./.venv/Scripts/python.exe -m ruff check .`
Expected: `All checks passed!`

Run: `./.venv/Scripts/python.exe manage.py makemigrations --check --dry-run`
Expected: `No changes detected`

- [ ] **Step 2: Suíte completa do frontend**

Run (em `frontend/`): `npm run test`
Expected: todos os arquivos passam

Run: `npm run build`
Expected: build sem erro de tipo

- [ ] **Step 3: Verificação manual contra a API real**

```bash
cd backend && ./.venv/Scripts/python.exe manage.py seed_dev
./.venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000
```

Em outro terminal, `cd frontend && npm run dev`. Abrir `http://localhost:5173/atendimentos` e conferir:

1. A lista mostra os atendimentos do seed com pet e tutor.
2. Filtrar por status Liberado reduz a lista.
3. "Novo atendimento": buscar "Luna" no combobox, selecionar. Como a Luna do seed **não** tem pacote (o seed não cria pacote), cai em avulso — a seção de pagamentos aparece.
4. Escolher o serviço "Banho" pré-preenche o valor com 60.00; editar para 75.00 (simula preço por pet).
5. Adicionar pagamento Pix 75.00: "Soma confere". Salvar cria o atendimento e volta à lista.
6. Na lista, "Liberar" o novo atendimento muda o status; "Cancelar atendimento" pede confirmação.
7. Criar um `PacoteContratado` para a Luna via admin ou shell, recarregar o form, escolher Luna: agora o banner do pacote aparece e os pagamentos somem. "Cobrar como avulso" revela os pagamentos de volta.

- [ ] **Step 4: Escrever o relatório didático**

Criar `estudos/PR-12-front-atendimentos.md` cobrindo, com o "porquê":

1. **O pré-vínculo de pacote como default seguro.** Por que vincular automático (e não pedir confirmação) elimina o erro humano que fatura em dobro; o reset de `cobrarAvulso` ao trocar de pet.
2. **`usePacoteAtivo` e o 204.** Como o `request<T>` devolve `null` no 204 e por que isso mapeia direto para "pet sem pacote".
3. **`useFieldArray`.** Como o react-hook-form gerencia uma lista dinâmica de pagamentos, e por que a soma ao vivo usa `watch`.
4. **O combobox à mão.** As decisões de a11y (roles, teclado, `aria-activedescendant`), por que não usei lib, e o que ficou de fora.
5. **Pricing snapshot na prática.** Por que o valor é editável no atendimento e não puxado fixo do serviço (a pergunta do Diogo sobre pinscher vs golden).
6. **`Controller` vs `register`.** Por que o campo pet (combobox) precisa de `Controller` e os demais usam `register`.

- [ ] **Step 5: Push e abrir o PR**

```bash
git push -u origin feat/front-atendimentos
gh pr create --base main --title "PR 12: Atendimentos" --body "Implementa docs/specs/2026-07-11-pr12-front-atendimentos-design.md"
```

`estudos/` está no `.gitignore` e não entra no commit. **Não** adicionar assinatura de IA ao corpo do PR (regra do CLAUDE.md global).

---

## Auto-revisão do plano

**Cobertura da spec.** Backend `pet_nome`/`tutor_nome` (Task 1); tipos + hooks incluindo `usePacoteAtivo` e `useBuscaPets` (Task 2); `Combobox` (Task 3); `PagamentosField` com soma ao vivo (Task 4); `PacoteAtivoBanner` + `AtendimentoForm` com o fluxo de pacote e o reset de `cobrarAvulso` (Task 5); lista, filtros, `StatusAcao`, cancelar com confirmação, rotas (Task 6); verificação + estudos (Task 7). Transporte condicional está no form (Task 5). Todos os testes da spec estão escritos por extenso.

**Placeholders.** Nenhum. Todo passo que muda código traz o código completo.

**Consistência de nomes.** `Pacote`, `AtendimentoEntrada`, `PagamentoEntrada`, `usePacoteAtivo`, `useBuscaPets`, `useAtendimentos`, `useCriarAtendimento`, `useAtualizarAtendimento`, `Combobox`/`ItemCombobox`, `PagamentosField`, `PacoteAtivoBanner`, `AtendimentoForm`, `AtendimentoTabela`, `StatusAcao`, `FiltrosAtendimento`, `cobrarAvulso`, `petSelecionado`, `usaPacote` — grafia consistente entre tasks.

**Auditoria (Opus, 2026-07-11).** O subagente Fable 5 caiu por limite de conta antes de rodar; a auditoria foi feita inline, verificando contra o código real. Achados corrigidos:

1. **BLOQUEADOR** — O `Host` do teste do `PagamentosField` (Task 4) criava `useForm({...})` sem genérico; o `control` inferido não casava com `Control<AtendimentoEntrada>` do componente. Como o `tsconfig.app.json` tem `include: ["src"]`, os testes entram no `tsc -b` e o `npm run build` quebraria. Corrigido para `useForm<AtendimentoEntrada>`.
2. **IMPORTANTE** — Faltava o debounce de 300ms da busca de pet (a spec pede). O form ligava `aoDigitarBusca={setTermoPet}` direto, um request por tecla. Corrigido com `textoPet` + `useEffect` de debounce → `setTermoPet`.
3. **IMPORTANTE** — O teste "escolher serviço pré-preenche valor" fazia `selectOptions` antes das options carregarem via MSW. Corrigido: aguarda `findByRole("option", {name:"Banho"})` e envolve o assert do valor em `waitFor` (o `setValue` do effect é assíncrono).

Pontos verificados e **sem** defeito: o `Controller` do pet valida via `petSelecionado` e o payload usa `petSelecionado?.id` (envia o pet certo); o teste de teclado do combobox bate com a implementação (destaque 0→1, clamp); `django_assert_max_num_queries(6)` é plausível (auth+count+select+prefetch ≈ 4); o `select_related("pet__tutor")` cobre `tutor_nome`; `request<T>` devolve `null` no 204; `Select`/`Input`/`Checkbox` espalham `...props` e aceitam `value`/`onChange`; nenhuma invariante de faturamento violada.
