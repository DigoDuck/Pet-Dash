# PR 13 · `feat/front-pacotes` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à Patricia uma tela para vender Pacote Fidelidade, ver o saldo de créditos de cada pet no mês e editar a validade — sem a qual o pré-vínculo automático do `AtendimentoForm` (PR 12) nunca dispara.

**Architecture:** Fatia vertical fina. O backend ganha filtro por competência, busca por pet e os nomes desnormalizados no serializer (habilitadores, ~15 linhas). O frontend ganha a página `/pacotes` no molde do `Servicos.tsx`: lista filtrada por mês + modal de venda/edição no molde do `ServicoForm`. Saldo continua derivado no backend (invariante 4); nada é materializado.

**Tech Stack:** Django REST Framework, django-filter, pytest + factory_boy · React 19, TanStack Query, react-hook-form + zod, Vitest + RTL + MSW.

**Spec:** `docs/specs/2026-07-13-pr13-front-pacotes-design.md`

## Global Constraints

- Branch: `feat/front-pacotes` (já criada, a partir do `main` com o PR 12 mergeado).
- Comentários de código em **português**; mensagens de commit em **inglês**, estilo conventional.
- **Nunca** adicionar trailer de coautoria ou assinatura de IA em commits/PRs.
- Backend: `ruff check .` e `pytest` verdes antes de considerar qualquer tarefa pronta. Rodar de dentro de `backend/`, com a venv ativa.
- Frontend: `npm run test` e `npm run build` (`tsc -b` + vite) verdes. Rodar de dentro de `frontend/`.
- Invariante 4 (saldo derivado): **nunca** criar campo `qtd_usada` nem persistir saldo.
- Invariante 7 (pricing snapshotado): `valor_pago` é o preço cobrado no dia. `Servico.preco_padrao` só sugere o preenchimento e **jamais** sobrescreve o valor de um pacote já salvo.
- A Task 6 é **do Diogo** (contrato de aprendizado do `CLAUDE.md`). Um agente executando este plano deve **parar na Task 5** e não escrever o código da Task 6.

---

### Task 1: Backend — filtro por competência, busca e nomes no serializer

**Files:**

- Modify: `backend/core/views.py:66-68` (`PacoteContratadoViewSet`)
- Modify: `backend/core/serializers.py:60-87` (`PacoteContratadoSerializer`)
- Test: `backend/tests/test_api_pacotes.py`

**Interfaces:**

- Consumes: nada (primeira task).
- Produces: `GET /api/pacotes/?competencia=YYYY-MM-01&search=<texto>&page=<n>` devolvendo o paginado padrão do DRF, com cada item no formato `{id, pet, pet_nome, tutor_nome, servico, servico_nome, competencia, qtd_total, valor_pago, data_compra, validade, saldo}`. É o contrato que as tasks 2, 4 e 5 consomem.

- [ ] **Step 1: Escrever os testes que falham**

Adicione ao final de `backend/tests/test_api_pacotes.py` (o arquivo já tem a fixture `api` e o `pytestmark`):

```python
def test_lista_filtra_por_competencia_e_traz_nomes(api):
    from tests.factories import PacoteContratadoFactory

    pacote = PacoteContratadoFactory(competencia=date(2026, 6, 1))
    PacoteContratadoFactory(competencia=date(2026, 7, 1))

    resp = api.get("/api/pacotes/?competencia=2026-06-01")

    assert resp.status_code == 200
    dados = resp.json()
    assert dados["count"] == 1
    item = dados["results"][0]
    assert item["id"] == pacote.id
    assert item["pet_nome"] == pacote.pet.nome
    assert item["tutor_nome"] == pacote.pet.tutor.nome
    assert item["servico_nome"] == pacote.servico.nome
    assert item["saldo"] == 4


def test_busca_pacote_pelo_nome_do_pet(api):
    from tests.factories import PacoteContratadoFactory, PetFactory

    alvo = PacoteContratadoFactory(pet=PetFactory(nome="Rex"), competencia=date(2026, 6, 1))
    PacoteContratadoFactory(pet=PetFactory(nome="Luna"), competencia=date(2026, 6, 1))

    resp = api.get("/api/pacotes/?search=Rex")

    assert resp.status_code == 200
    assert [p["id"] for p in resp.json()["results"]] == [alvo.id]
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `cd backend && pytest tests/test_api_pacotes.py -v`
Expected: FAIL. `test_lista_filtra_por_competencia_e_traz_nomes` falha com `KeyError: 'pet_nome'` (o serializer não expõe o campo) e `count == 2` (o filtro `?competencia=` é ignorado hoje, porque o ViewSet não declara `filterset_fields`).

- [ ] **Step 3: Adicionar os nomes ao serializer**

Em `backend/core/serializers.py`, substitua a declaração do `PacoteContratadoSerializer` (mantendo `get_saldo` e `validate` como estão):

```python
class PacoteContratadoSerializer(serializers.ModelSerializer):
    saldo = serializers.SerializerMethodField()
    pet_nome = serializers.CharField(source="pet.nome", read_only=True)
    tutor_nome = serializers.CharField(source="pet.tutor.nome", read_only=True)
    servico_nome = serializers.CharField(source="servico.nome", read_only=True)

    class Meta:
        model = models.PacoteContratado
        fields = [
            "id", "pet", "pet_nome", "tutor_nome", "servico", "servico_nome",
            "competencia", "qtd_total", "valor_pago", "data_compra", "validade", "saldo",
        ]
```

- [ ] **Step 4: Adicionar filtro, busca e select_related no ViewSet**

Em `backend/core/views.py`, substitua o `PacoteContratadoViewSet` inteiro:

```python
class PacoteContratadoViewSet(viewsets.ModelViewSet):
    serializer_class = serializers.PacoteContratadoSerializer
    filterset_fields = ["pet", "competencia"]
    search_fields = ["pet__nome", "pet__tutor__nome"]
    # select_related: sem ele, os *_nome do serializer fazem uma query por linha.
    # Desempate por pet__nome mantém a paginação estável dentro do mesmo mês.
    queryset = (
        models.PacoteContratado.objects
        .select_related("pet", "pet__tutor", "servico")
        .order_by("-competencia", "pet__nome")
    )
```

`competencia` é `DateField` de match exato e o `save()` do model normaliza para o dia 1, então `?competencia=2026-06-01` sempre casa com o pacote daquele mês.

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `cd backend && pytest tests/test_api_pacotes.py -v`
Expected: PASS nos 5 testes do arquivo (os 3 antigos continuam verdes).

- [ ] **Step 6: Suíte completa e lint**

Run: `cd backend && pytest && ruff check .`
Expected: toda a suíte verde, `All checks passed!`.

- [ ] **Step 7: Commit**

```bash
git add backend/core/views.py backend/core/serializers.py backend/tests/test_api_pacotes.py
git commit -m "feat: filter pacotes by competencia and expose pet/servico names"
```

---

### Task 2: Frontend — tipos e hooks de pacote

**Files:**

- Modify: `frontend/src/lib/types.ts:82-92` (interface `Pacote`)
- Modify: `frontend/src/hooks/useServicos.ts` (novo `useServicosPacote`)
- Create: `frontend/src/hooks/usePacotes.ts`
- Test: `frontend/src/hooks/usePacotes.test.tsx`

**Interfaces:**

- Consumes: o contrato da API da Task 1.
- Produces:
  - `Pacote` com `pet_nome`, `tutor_nome`, `servico_nome`.
  - `PacoteEntrada = { pet: number; servico: number; competencia: string; qtd_total: number; valor_pago: string; data_compra: string; validade: string }`.
  - `usePacotes(competencia: string, busca: string, pagina: number)` → `UseQueryResult<Paginated<Pacote>>`.
  - `useCriarPacote()` → mutation com `mutate(dados: PacoteEntrada)`.
  - `useAtualizarPacote(id: number)` → mutation com `mutate(dados: Partial<PacoteEntrada>)`.
  - `useServicosPacote()` → `UseQueryResult<Paginated<Servico>>` (só serviços com `is_pacote=true` e ativos).

- [ ] **Step 1: Escrever o teste que falha**

Crie `frontend/src/hooks/usePacotes.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "../test/msw/server";
import { useCriarPacote, usePacotes } from "./usePacotes";

const BASE = "http://localhost:8000/api";

function ambiente() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("usePacotes", () => {
  it("manda competência, busca e página na query", async () => {
    let url = "";
    server.use(
      http.get(`${BASE}/pacotes/`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] });
      }),
    );
    const { wrapper } = ambiente();

    const { result } = renderHook(() => usePacotes("2026-07-01", "rex", 2), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(url).toContain("competencia=2026-07-01");
    expect(url).toContain("search=rex");
    expect(url).toContain("page=2");
  });

  it("ao vender, invalida também a chave pacote-ativo", async () => {
    server.use(
      http.post(`${BASE}/pacotes/`, () => HttpResponse.json({ id: 1 }, { status: 201 })),
    );
    const { client, wrapper } = ambiente();
    const invalidar = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCriarPacote(), { wrapper });
    result.current.mutate({
      pet: 1,
      servico: 2,
      competencia: "2026-07-01",
      qtd_total: 4,
      valor_pago: "220.00",
      data_compra: "2026-07-13",
      validade: "2026-07-31",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["pacote-ativo"] });
  });
});
```

O segundo teste é o mais importante do PR: ele guarda a invariante de faturamento. Sem invalidar `pacote-ativo`, vender um pacote e ir direto ao `AtendimentoForm` serviria cache velho, o atendimento nasceria avulso e o dinheiro do pacote seria contado duas vezes.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm run test -- usePacotes`
Expected: FAIL — `Failed to resolve import "./usePacotes"`.

- [ ] **Step 3: Estender os tipos**

Em `frontend/src/lib/types.ts`, substitua a interface `Pacote` e adicione `PacoteEntrada` logo abaixo:

```ts
export interface Pacote {
  id: number;
  pet: number;
  pet_nome: string;
  tutor_nome: string;
  servico: number;
  servico_nome: string;
  competencia: string;
  qtd_total: number;
  valor_pago: string;
  data_compra: string;
  validade: string;
  /** Derivado no backend (invariante 4): qtd_total - atendimentos não cancelados. */
  saldo: number;
}

export interface PacoteEntrada {
  pet: number;
  servico: number;
  /** Sempre o dia 1 do mês ("2026-07-01"); o backend normaliza de qualquer forma. */
  competencia: string;
  qtd_total: number;
  valor_pago: string;
  data_compra: string;
  validade: string;
}
```

- [ ] **Step 4: Criar o hook de serviços-pacote**

Ao final de `frontend/src/hooks/useServicos.ts`:

```ts
// Só os serviços que são pacote, para o Select da venda. A chave começa com
// "servicos", então as mutations de serviço já invalidam esta query também.
export function useServicosPacote() {
  return useQuery({
    queryKey: ["servicos", "pacotes"] as const,
    queryFn: () => request<Paginated<Servico>>("/servicos/?is_pacote=true&ativo=true"),
  });
}
```

- [ ] **Step 5: Criar `usePacotes.ts`**

```ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Pacote, PacoteEntrada, Paginated } from "../lib/types";

export const chavesPacotes = {
  raiz: ["pacotes"] as const,
  lista: (competencia: string, busca: string, pagina: number) =>
    ["pacotes", "lista", competencia, busca, pagina] as const,
};

// Invalida a lista E o pacote-ativo. Sem a segunda chave, o AtendimentoForm
// serviria cache velho logo após a venda, o atendimento nasceria avulso e o
// dinheiro do pacote entraria duas vezes no faturamento (invariantes 1 e 2).
function invalidarPacotes(client: QueryClient) {
  client.invalidateQueries({ queryKey: chavesPacotes.raiz });
  client.invalidateQueries({ queryKey: ["pacote-ativo"] });
}

export function usePacotes(competencia: string, busca: string, pagina: number) {
  const params = new URLSearchParams({ page: String(pagina) });
  if (competencia) params.set("competencia", competencia);
  if (busca) params.set("search", busca);
  return useQuery({
    queryKey: chavesPacotes.lista(competencia, busca, pagina),
    queryFn: () => request<Paginated<Pacote>>(`/pacotes/?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useCriarPacote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: PacoteEntrada) =>
      request<Pacote>("/pacotes/", { method: "POST", body: JSON.stringify(dados) }),
    onSuccess: () => invalidarPacotes(client),
  });
}

export function useAtualizarPacote(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: Partial<PacoteEntrada>) =>
      request<Pacote>(`/pacotes/${id}/`, { method: "PATCH", body: JSON.stringify(dados) }),
    onSuccess: () => invalidarPacotes(client),
  });
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd frontend && npm run test -- usePacotes`
Expected: PASS nos 2 testes.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/hooks/usePacotes.ts frontend/src/hooks/usePacotes.test.tsx frontend/src/hooks/useServicos.ts
git commit -m "feat: add Pacote types and usePacotes hooks with pacote-ativo invalidation"
```

---

### Task 3: Frontend — utilitários de competência e mensagem de erro da API

**Files:**

- Create: `frontend/src/lib/competencia.ts`
- Create: `frontend/src/lib/competencia.test.ts`
- Modify: `frontend/src/lib/api.ts` (nova função `mensagemDeErro`)
- Test: `frontend/src/lib/api.test.ts` (arquivo já existe; adicionar um `describe`)

**Interfaces:**

- Consumes: `ApiError` de `lib/api.ts` (já existe).
- Produces:
  - `mesCorrente(hoje?: Date): string` → `"2026-07"`.
  - `hojeISO(hoje?: Date): string` → `"2026-07-13"`.
  - `inicioDaCompetencia(mes: string): string` → `"2026-07"` vira `"2026-07-01"`.
  - `mesDaCompetencia(competencia: string): string` → `"2026-07-01"` vira `"2026-07"`.
  - `ultimoDiaDoMes(mes: string): string` → `"2026-07"` vira `"2026-07-31"`.
  - `formatarData(iso: string): string` → `"2026-07-31"` vira `"31/07/2026"`.
  - `mensagemDeErro(erro: unknown): string` (em `lib/api.ts`).

- [ ] **Step 1: Escrever os testes que falham**

Crie `frontend/src/lib/competencia.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  formatarData,
  hojeISO,
  inicioDaCompetencia,
  mesCorrente,
  mesDaCompetencia,
  ultimoDiaDoMes,
} from "./competencia";

describe("competencia", () => {
  it("converte o mês do input para a competência do backend", () => {
    expect(inicioDaCompetencia("2026-07")).toBe("2026-07-01");
    expect(mesDaCompetencia("2026-07-01")).toBe("2026-07");
  });

  it("acha o último dia do mês, inclusive fevereiro bissexto", () => {
    expect(ultimoDiaDoMes("2026-07")).toBe("2026-07-31");
    expect(ultimoDiaDoMes("2026-02")).toBe("2026-02-28");
    expect(ultimoDiaDoMes("2028-02")).toBe("2028-02-29");
    expect(ultimoDiaDoMes("2026-12")).toBe("2026-12-31");
  });

  it("deriva mês e dia correntes da data local", () => {
    const hoje = new Date(2026, 6, 13); // 13/07/2026, hora local
    expect(mesCorrente(hoje)).toBe("2026-07");
    expect(hojeISO(hoje)).toBe("2026-07-13");
  });

  it("formata a data ISO para o padrão brasileiro", () => {
    expect(formatarData("2026-07-31")).toBe("31/07/2026");
  });
});
```

Adicione ao final de `frontend/src/lib/api.test.ts` (o arquivo já importa de `./api`; ajuste o import existente para incluir `ApiError` e `mensagemDeErro`):

```ts
describe("mensagemDeErro", () => {
  it("extrai a mensagem de non_field_errors do DRF", () => {
    const erro = new ApiError(400, {
      non_field_errors: ["Já existe um pacote para este pet nesta competência."],
    });
    expect(mensagemDeErro(erro)).toBe("Já existe um pacote para este pet nesta competência.");
  });

  it("extrai a mensagem de um erro de campo", () => {
    const erro = new ApiError(400, { valor_pago: ["Informe um número válido."] });
    expect(mensagemDeErro(erro)).toBe("Informe um número válido.");
  });

  it("tem fallback para erro que não é da API", () => {
    expect(mensagemDeErro(new Error("boom"))).toBe("Erro inesperado. Tente de novo.");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm run test -- competencia api`
Expected: FAIL — `Failed to resolve import "./competencia"` e `mensagemDeErro is not a function`.

- [ ] **Step 3: Criar `lib/competencia.ts`**

```ts
/** "2026-07" -> "2026-07-01". O backend normaliza a competência para o dia 1. */
export function inicioDaCompetencia(mes: string): string {
  return `${mes}-01`;
}

/** "2026-07-01" -> "2026-07", formato do <input type="month">. */
export function mesDaCompetencia(competencia: string): string {
  return competencia.slice(0, 7);
}

/** "2026-07" -> "2026-07-31". Dia 0 do mês seguinte é o último do mês pedido;
 *  em UTC para o fuso local não empurrar a data um dia para trás. */
export function ultimoDiaDoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, m, 0)).toISOString().slice(0, 10);
}

export function mesCorrente(hoje: Date = new Date()): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

/** Data local em ISO. Não usar toISOString() aqui: à noite no fuso -03 ele
 *  devolveria o dia seguinte. */
export function hojeISO(hoje: Date = new Date()): string {
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${mesCorrente(hoje)}-${dia}`;
}

/** "2026-07-31" -> "31/07/2026". Sem passar por Date: a string já é a verdade. */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
```

- [ ] **Step 4: Adicionar `mensagemDeErro` em `lib/api.ts`**

Ao final de `frontend/src/lib/api.ts`:

```ts
/** Extrai a mensagem legível de um erro do DRF ({"non_field_errors": ["..."]}
 *  ou {"campo": ["..."]}). Sem isto, uma mutation rejeitada falharia calada. */
export function mensagemDeErro(erro: unknown): string {
  if (!(erro instanceof ApiError)) return "Erro inesperado. Tente de novo.";
  const detail = erro.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const primeiro = Object.values(detail as Record<string, unknown>)[0];
    if (Array.isArray(primeiro) && typeof primeiro[0] === "string") return primeiro[0];
    if (typeof primeiro === "string") return primeiro;
  }
  return "Não foi possível salvar. Tente de novo.";
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd frontend && npm run test -- competencia api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/competencia.ts frontend/src/lib/competencia.test.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git commit -m "feat: add competencia date helpers and DRF error message extractor"
```

---

### Task 4: Frontend — `PacoteForm`

**Files:**

- Create: `frontend/src/components/pacotes/PacoteForm.tsx`
- Test: `frontend/src/components/pacotes/PacoteForm.test.tsx`

**Interfaces:**

- Consumes: `PacoteEntrada` e `Pacote` (`lib/types`), `useServicosPacote` (`hooks/useServicos`), `useBuscaPets` (`hooks/usePets`, já existe — devolve `Paginated<Pet>` a partir de um termo de busca), `inicioDaCompetencia`/`mesDaCompetencia`/`ultimoDiaDoMes`/`mesCorrente`/`hojeISO` (`lib/competencia`), componentes `Combobox`, `Select`, `Input`, `Button`.
- Produces: `<PacoteForm inicial? aoSalvar enviando erro? aoCancelar />`, onde `aoSalvar: (dados: PacoteEntrada) => void`.

- [ ] **Step 1: Escrever os testes que falham**

Crie `frontend/src/components/pacotes/PacoteForm.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../test/msw/server";
import { PacoteForm } from "./PacoteForm";

const BASE = "http://localhost:8000/api";

function paginado(results: unknown[]) {
  return { count: results.length, next: null, previous: null, results };
}

function renderizar(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// toFake: ["Date"] falsifica SÓ o relógio. O setTimeout continua real, então o
// debounce de 300ms da busca de pet se comporta como nos testes do PR 12 (que
// passam sem fake timers). Falsificar os timers inteiros trava o userEvent.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 6, 13)); // 13/07/2026
  server.use(
    http.get(`${BASE}/servicos/`, () =>
      HttpResponse.json(
        paginado([
          { id: 5, nome: "Pacote Fidelidade", preco_padrao: "220.00", is_pacote: true, creditos: 4, ativo: true },
        ]),
      ),
    ),
    http.get(`${BASE}/pets/`, () =>
      HttpResponse.json(
        paginado([
          {
            id: 7, tutor: 3, tutor_nome: "Ana", nome: "Luna", raca: "", porte: "",
            ativo: true, created_at: "", vip: false, qtd_visitas: 0, total_gasto: "0.00",
          },
        ]),
      ),
    ),
  );
});

afterEach(() => vi.useRealTimers());

// Mesmo passo a passo do AtendimentoForm.test: esperar a option aparecer via
// MSW antes de clicar, senão o combobox ainda está vazio.
async function escolherLuna() {
  await userEvent.type(screen.getByLabelText("Pet"), "Luna");
  await waitFor(() => expect(screen.getByText("Luna · Ana")).toBeInTheDocument());
  await userEvent.click(screen.getByText("Luna · Ana"));
}

describe("PacoteForm", () => {
  it("escolher o serviço sugere valor e créditos do catálogo", async () => {
    renderizar(<PacoteForm aoSalvar={vi.fn()} enviando={false} aoCancelar={vi.fn()} />);

    // Sem esperar a option carregar, selectOptions estoura com "value not found".
    await screen.findByRole("option", { name: "Pacote Fidelidade" });
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "5");

    await waitFor(() => expect(screen.getByLabelText("Valor pago")).toHaveValue("220.00"));
    expect(screen.getByLabelText("Créditos")).toHaveValue(4);
  });

  it("mudar a competência recalcula a validade para o último dia do mês", async () => {
    renderizar(<PacoteForm aoSalvar={vi.fn()} enviando={false} aoCancelar={vi.fn()} />);

    const mes = await screen.findByLabelText("Competência");
    expect(screen.getByLabelText("Validade")).toHaveValue("2026-07-31");

    await userEvent.clear(mes);
    await userEvent.type(mes, "2026-02");

    await waitFor(() => expect(screen.getByLabelText("Validade")).toHaveValue("2026-02-28"));
  });

  it("envia a competência como dia 1 e os números convertidos", async () => {
    const aoSalvar = vi.fn();
    renderizar(<PacoteForm aoSalvar={aoSalvar} enviando={false} aoCancelar={vi.fn()} />);

    await screen.findByRole("option", { name: "Pacote Fidelidade" });
    await escolherLuna();
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "5");
    await waitFor(() => expect(screen.getByLabelText("Valor pago")).toHaveValue("220.00"));

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(aoSalvar).toHaveBeenCalledWith({
        pet: 7,
        servico: 5,
        competencia: "2026-07-01",
        qtd_total: 4,
        valor_pago: "220.00",
        data_compra: "2026-07-13",
        validade: "2026-07-31",
      }),
    );
  });

  it("sem pet escolhido, não envia e mostra o erro", async () => {
    const aoSalvar = vi.fn();
    renderizar(<PacoteForm aoSalvar={aoSalvar} enviando={false} aoCancelar={vi.fn()} />);

    await screen.findByRole("option", { name: "Pacote Fidelidade" });
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Escolha um pet")).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it("na edição, o valor salvo não é sobrescrito pelo preço do catálogo", async () => {
    renderizar(
      <PacoteForm
        inicial={{
          id: 1, pet: 7, pet_nome: "Luna", tutor_nome: "Ana", servico: 5,
          servico_nome: "Pacote Fidelidade", competencia: "2026-07-01", qtd_total: 4,
          valor_pago: "180.00", data_compra: "2026-07-02", validade: "2026-07-31", saldo: 3,
        }}
        aoSalvar={vi.fn()}
        enviando={false}
        aoCancelar={vi.fn()}
      />,
    );

    // 180.00 é o preço realmente cobrado (invariante 7). O catálogo diz 220.00
    // e não pode vencer.
    expect(await screen.findByLabelText("Valor pago")).toHaveValue("180.00");
    expect(screen.getByLabelText("Competência")).toBeDisabled();
  });

  it("exibe a mensagem de erro vinda da API", async () => {
    renderizar(
      <PacoteForm
        aoSalvar={vi.fn()}
        enviando={false}
        erro="Já existe um pacote para este pet nesta competência."
        aoCancelar={vi.fn()}
      />,
    );

    expect(
      await screen.findByText("Já existe um pacote para este pet nesta competência."),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm run test -- PacoteForm`
Expected: FAIL — `Failed to resolve import "./PacoteForm"`.

- [ ] **Step 3: Implementar o `PacoteForm`**

Crie `frontend/src/components/pacotes/PacoteForm.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useBuscaPets } from "../../hooks/usePets";
import { useServicosPacote } from "../../hooks/useServicos";
import {
  hojeISO,
  inicioDaCompetencia,
  mesCorrente,
  mesDaCompetencia,
  ultimoDiaDoMes,
} from "../../lib/competencia";
import type { Pacote, PacoteEntrada } from "../../lib/types";
import { Button } from "../ui/Button";
import { Combobox } from "../ui/Combobox";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const schema = z.object({
  pet: z.number().min(1, "Escolha um pet"),
  servico: z.string().refine((v) => Number(v) > 0, "Escolha o serviço"),
  mes: z.string().min(1, "Informe a competência"),
  qtd_total: z
    .string()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, "Mínimo de 1 crédito"),
  valor_pago: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (ex.: 220.00)"),
  data_compra: z.string().min(1, "Informe a data da compra"),
  validade: z.string().min(1, "Informe a validade"),
});

type FormData = z.infer<typeof schema>;

interface PacoteFormProps {
  /** Presente => edição: pet e competência ficam travados (são a chave única). */
  inicial?: Pacote;
  aoSalvar: (dados: PacoteEntrada) => void;
  enviando: boolean;
  erro?: string;
  aoCancelar: () => void;
}

export function PacoteForm({ inicial, aoSalvar, enviando, erro, aoCancelar }: PacoteFormProps) {
  const editando = inicial != null;
  const [textoPet, setTextoPet] = useState("");
  const [termoPet, setTermoPet] = useState("");
  const [petSelecionado, setPetSelecionado] = useState<{ id: number; rotulo: string } | null>(
    inicial ? { id: inicial.pet, rotulo: `${inicial.pet_nome} · ${inicial.tutor_nome}` } : null,
  );

  // Debounce da busca de pet (300ms), como no AtendimentoForm: sem isto cada
  // tecla dispara um GET /pets/?search=.
  useEffect(() => {
    const t = setTimeout(() => setTermoPet(textoPet), 300);
    return () => clearTimeout(t);
  }, [textoPet]);

  const buscaPets = useBuscaPets(termoPet);
  const servicos = useServicosPacote();
  const listaServicos = servicos.data?.results ?? [];

  const mesInicial = inicial ? mesDaCompetencia(inicial.competencia) : mesCorrente();

  const { control, register, handleSubmit, setValue, watch, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      pet: inicial?.pet ?? 0,
      servico: inicial ? String(inicial.servico) : "0",
      mes: mesInicial,
      qtd_total: String(inicial?.qtd_total ?? 4),
      valor_pago: inicial?.valor_pago ?? "",
      data_compra: inicial?.data_compra ?? hojeISO(),
      validade: inicial?.validade ?? ultimoDiaDoMes(mesInicial),
    },
  });

  const servicoAtual = watch("servico");
  const mesAtual = watch("mes");

  // Os dois effects abaixo pulam o disparo de montagem. Na edição, rodar no
  // mount sobrescreveria o valor realmente cobrado com o preço do catálogo
  // (quebra a invariante 7) e a validade estendida à mão (invariante 5).
  const servicoMontado = useRef(false);
  useEffect(() => {
    if (!servicoMontado.current) {
      servicoMontado.current = true;
      return;
    }
    const s = listaServicos.find((x) => x.id === Number(servicoAtual));
    if (!s) return;
    setValue("valor_pago", s.preco_padrao);
    setValue("qtd_total", String(s.creditos ?? 4));
  }, [servicoAtual]); // eslint-disable-line react-hooks/exhaustive-deps

  const mesMontado = useRef(false);
  useEffect(() => {
    if (!mesMontado.current) {
      mesMontado.current = true;
      return;
    }
    if (mesAtual) setValue("validade", ultimoDiaDoMes(mesAtual));
  }, [mesAtual]); // eslint-disable-line react-hooks/exhaustive-deps

  function escolherPet(item: { id: number; rotulo: string } | null) {
    setPetSelecionado(item);
    setValue("pet", item?.id ?? 0, { shouldValidate: formState.isSubmitted });
  }

  function enviar(dados: FormData) {
    aoSalvar({
      pet: dados.pet,
      servico: Number(dados.servico),
      competencia: inicioDaCompetencia(dados.mes),
      qtd_total: Number(dados.qtd_total),
      valor_pago: dados.valor_pago,
      data_compra: dados.data_compra,
      validade: dados.validade,
    });
  }

  const itensPet =
    buscaPets.data?.results.map((p) => ({ id: p.id, rotulo: `${p.nome} · ${p.tutor_nome}` })) ?? [];

  return (
    <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4" noValidate>
      {erro && (
        <p role="alert" className="rounded-lg bg-erro/10 px-3 py-2 text-sm text-erro">
          {erro}
        </p>
      )}

      {editando ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-escuro">Pet</span>
          <p className="text-sm text-neutro">
            {inicial.pet_nome} · {inicial.tutor_nome}
          </p>
        </div>
      ) : (
        <Controller
          control={control}
          name="pet"
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
      )}

      <Select label="Serviço" error={formState.errors.servico?.message} {...register("servico")}>
        <option value="0">Selecione...</option>
        {listaServicos.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-4">
        {/* Competência trava na edição: junto com o pet, é a chave única do
            pacote — mudá-la seria outra venda disfarçada de edição. */}
        <Input
          label="Competência"
          type="month"
          disabled={editando}
          error={formState.errors.mes?.message}
          {...register("mes")}
        />
        <Input
          label="Validade"
          type="date"
          error={formState.errors.validade?.message}
          {...register("validade")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Valor pago"
          inputMode="decimal"
          placeholder="220.00"
          error={formState.errors.valor_pago?.message}
          {...register("valor_pago")}
        />
        <Input
          label="Créditos"
          type="number"
          min={1}
          error={formState.errors.qtd_total?.message}
          {...register("qtd_total")}
        />
      </div>

      <Input
        label="Data da compra"
        type="date"
        error={formState.errors.data_compra?.message}
        {...register("data_compra")}
      />

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

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `cd frontend && npm run test -- PacoteForm`
Expected: PASS nos 6 testes. (`Input` e `Select` já aceitam `error?: string` — não há nada a mudar em `components/ui/`.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pacotes/
git commit -m "feat: add PacoteForm with catalog defaults and locked keys on edit"
```

---

### Task 5: Frontend — página `/pacotes`

**Files:**

- Create: `frontend/src/components/pacotes/SaldoBadge.tsx`
- Modify: `frontend/src/pages/Pacotes.tsx` (hoje é só `<EmConstrucao />`)
- Test: `frontend/src/pages/Pacotes.test.tsx`

**Interfaces:**

- Consumes: `usePacotes`, `useCriarPacote`, `useAtualizarPacote` (Task 2), `mesCorrente`/`inicioDaCompetencia`/`formatarData` (Task 3), `PacoteForm` (Task 4), `mensagemDeErro` (Task 3), componentes `Modal`, `Input`, `Button`, `Badge`, `Paginacao`, `EstadoVazio`, `ErroAoCarregar`.
- Produces: a página final. A rota `/pacotes` e o link "Pacotes" na Sidebar **já existem** (`routes/router.tsx:32`, `components/layout/Sidebar.tsx`) — nada a mudar lá.

- [ ] **Step 1: Escrever os testes que falham**

Crie `frontend/src/pages/Pacotes.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../test/msw/server";
import { renderizarComProvedores } from "../test/utils";
import { Pacotes } from "./Pacotes";

const BASE = "http://localhost:8000/api";

function pacote(over: Record<string, unknown> = {}) {
  return {
    id: 1, pet: 7, pet_nome: "Luna", tutor_nome: "Ana", servico: 5,
    servico_nome: "Pacote Fidelidade", competencia: "2026-07-01", qtd_total: 4,
    valor_pago: "220.00", data_compra: "2026-07-02", validade: "2026-07-31", saldo: 3,
    ...over,
  };
}

function paginado(results: unknown[]) {
  return { count: results.length, next: null, previous: null, results };
}

function renderizar() {
  return renderizarComProvedores(<Pacotes />, { rota: "/pacotes", caminho: "/pacotes" });
}

// toFake: ["Date"] falsifica só o relógio; o setTimeout do debounce continua real.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 6, 13)); // 13/07/2026
  server.use(
    http.get(`${BASE}/servicos/`, () =>
      HttpResponse.json(
        paginado([
          { id: 5, nome: "Pacote Fidelidade", preco_padrao: "220.00", is_pacote: true, creditos: 4, ativo: true },
        ]),
      ),
    ),
    http.get(`${BASE}/pets/`, () =>
      HttpResponse.json(
        paginado([
          {
            id: 7, tutor: 3, tutor_nome: "Ana", nome: "Luna", raca: "", porte: "",
            ativo: true, created_at: "", vip: false, qtd_visitas: 0, total_gasto: "0.00",
          },
        ]),
      ),
    ),
  );
});

afterEach(() => vi.useRealTimers());

async function preencherVenda() {
  await userEvent.click(screen.getAllByRole("button", { name: "Vender pacote" })[0]);
  await screen.findByRole("option", { name: "Pacote Fidelidade" });

  await userEvent.type(screen.getByLabelText("Pet"), "Luna");
  await waitFor(() => expect(screen.getByText("Luna · Ana")).toBeInTheDocument());
  await userEvent.click(screen.getByText("Luna · Ana"));

  await userEvent.selectOptions(screen.getByLabelText("Serviço"), "5");
  await waitFor(() => expect(screen.getByLabelText("Valor pago")).toHaveValue("220.00"));
  await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
}

describe("Pacotes", () => {
  it("lista os pacotes da competência corrente com saldo e pet", async () => {
    let url = "";
    server.use(
      http.get(`${BASE}/pacotes/`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(paginado([pacote()]));
      }),
    );

    renderizar();

    expect(await screen.findByText("Luna")).toBeInTheDocument();
    expect(screen.getByText("3/4 créditos")).toBeInTheDocument();
    expect(url).toContain("competencia=2026-07-01");
  });

  it("mostra estado vazio quando o mês não tem pacote", async () => {
    server.use(http.get(`${BASE}/pacotes/`, () => HttpResponse.json(paginado([]))));

    renderizar();

    expect(await screen.findByText("Nenhum pacote neste mês")).toBeInTheDocument();
  });

  it("vende um pacote pelo modal e fecha", async () => {
    let corpo: Record<string, unknown> | null = null;
    server.use(
      http.get(`${BASE}/pacotes/`, () => HttpResponse.json(paginado([]))),
      http.post(`${BASE}/pacotes/`, async ({ request }) => {
        corpo = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(pacote(), { status: 201 });
      }),
    );

    renderizar();
    await screen.findByText("Nenhum pacote neste mês");
    await preencherVenda();

    await waitFor(() =>
      expect(corpo).toMatchObject({ pet: 7, servico: 5, competencia: "2026-07-01" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("venda duplicada mostra a mensagem do backend dentro do modal", async () => {
    server.use(
      http.get(`${BASE}/pacotes/`, () => HttpResponse.json(paginado([]))),
      http.post(`${BASE}/pacotes/`, () =>
        HttpResponse.json(
          { non_field_errors: ["Já existe um pacote para este pet nesta competência."] },
          { status: 400 },
        ),
      ),
    );

    renderizar();
    await screen.findByText("Nenhum pacote neste mês");
    await preencherVenda();

    expect(
      await screen.findByText("Já existe um pacote para este pet nesta competência."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm run test -- Pacotes`
Expected: FAIL — a página ainda renderiza `<EmConstrucao />`, então `findByText("Luna")` estoura por timeout.

- [ ] **Step 3: Criar o `SaldoBadge`**

`frontend/src/components/pacotes/SaldoBadge.tsx`:

```tsx
import { Badge } from "../ui/Badge";

interface SaldoBadgeProps {
  saldo: number;
  total: number;
}

/** Saldo zerado perde o destaque dourado: o pacote do mês acabou. */
export function SaldoBadge({ saldo, total }: SaldoBadgeProps) {
  return (
    <Badge variant={saldo === 0 ? "neutro" : "vip"}>
      {saldo}/{total} créditos
    </Badge>
  );
}
```

- [ ] **Step 4: Escrever a página**

Substitua o conteúdo de `frontend/src/pages/Pacotes.tsx`:

```tsx
import { useEffect, useState } from "react";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { EstadoVazio } from "../components/EstadoVazio";
import { PacoteForm } from "../components/pacotes/PacoteForm";
import { SaldoBadge } from "../components/pacotes/SaldoBadge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Paginacao } from "../components/ui/Paginacao";
import { useAtualizarPacote, useCriarPacote, usePacotes } from "../hooks/usePacotes";
import { mensagemDeErro } from "../lib/api";
import { formatarData, inicioDaCompetencia, mesCorrente } from "../lib/competencia";
import type { Pacote } from "../lib/types";

function formatarPreco(valor: string): string {
  return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
}

export function Pacotes() {
  const [mes, setMes] = useState(mesCorrente());
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [vendendo, setVendendo] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Pacote | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setBusca(texto);
      setPagina(1);
    }, 300);
    return () => clearTimeout(id);
  }, [texto]);

  const { data, isPending, isError, refetch } = usePacotes(
    inicioDaCompetencia(mes),
    busca,
    pagina,
  );
  const criar = useCriarPacote();

  function fecharVenda() {
    setVendendo(false);
    criar.reset(); // senão o erro da tentativa anterior reaparece no próximo modal
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Pacotes</h1>
        <Button onClick={() => setVendendo(true)}>Vender pacote</Button>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        {/* Rótulo "Mês", não "Competência": o campo do modal já usa esse nome, e
            dois rótulos iguais na tela deixariam o leitor de tela ambíguo. */}
        <Input
          label="Mês"
          type="month"
          value={mes}
          onChange={(e) => {
            setMes(e.target.value);
            setPagina(1);
          }}
        />
        <div className="max-w-sm flex-1">
          <Input
            label="Buscar por pet ou tutor"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Luna, Ana..."
          />
        </div>
      </div>

      <div className="mt-6">
        {isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => refetch()} />
        ) : isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : data.count === 0 ? (
          <EstadoVazio
            titulo={busca ? "Nenhum pacote encontrado" : "Nenhum pacote neste mês"}
            descricao={
              busca
                ? "Tente outro nome de pet ou tutor."
                : "Venda o primeiro Pacote Fidelidade da competência."
            }
            acao={busca ? undefined : <Button onClick={() => setVendendo(true)}>Vender pacote</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
                    <th className="px-6 py-3 font-semibold">Pet</th>
                    <th className="px-2 py-3 font-semibold">Serviço</th>
                    <th className="px-2 py-3 font-semibold">Saldo</th>
                    <th className="px-2 py-3 font-semibold text-right">Valor pago</th>
                    <th className="px-2 py-3 font-semibold">Validade</th>
                    <th className="px-6 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50"
                    >
                      <td className="px-6 py-4">
                        <span className="font-medium text-escuro">{p.pet_nome}</span>
                        <span className="block text-xs text-neutro">{p.tutor_nome}</span>
                      </td>
                      <td className="px-2 py-4 text-escuro">{p.servico_nome}</td>
                      <td className="px-2 py-4">
                        <SaldoBadge saldo={p.saldo} total={p.qtd_total} />
                      </td>
                      <td className="px-2 py-4 text-right font-mono font-semibold text-escuro">
                        {formatarPreco(p.valor_pago)}
                      </td>
                      <td className="px-2 py-4 font-mono text-neutro">{formatarData(p.validade)}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <Button variant="ghost" onClick={() => setEmEdicao(p)}>
                            Editar
                          </Button>
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

      <Modal aberto={vendendo} titulo="Vender pacote" aoFechar={fecharVenda}>
        <PacoteForm
          enviando={criar.isPending}
          erro={criar.isError ? mensagemDeErro(criar.error) : undefined}
          aoCancelar={fecharVenda}
          aoSalvar={(dados) => criar.mutate(dados, { onSuccess: fecharVenda })}
        />
      </Modal>

      {emEdicao && <ModalEdicao pacote={emEdicao} aoFechar={() => setEmEdicao(null)} />}
    </div>
  );
}

function ModalEdicao({ pacote, aoFechar }: { pacote: Pacote; aoFechar: () => void }) {
  const atualizar = useAtualizarPacote(pacote.id);
  return (
    <Modal aberto titulo="Editar pacote" aoFechar={aoFechar}>
      <PacoteForm
        inicial={pacote}
        enviando={atualizar.isPending}
        erro={atualizar.isError ? mensagemDeErro(atualizar.error) : undefined}
        aoCancelar={aoFechar}
        aoSalvar={(dados) => atualizar.mutate(dados, { onSuccess: aoFechar })}
      />
    </Modal>
  );
}
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `cd frontend && npm run test -- Pacotes`
Expected: PASS nos 4 testes.

- [ ] **Step 6: Suíte completa, lint e build**

Run: `cd frontend && npm run test && npm run lint && npm run build`
Expected: todos os testes verdes (inclusive os do PR 12, que não podem regredir), oxlint sem erro, build sem erro de tipo.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Pacotes.tsx frontend/src/pages/Pacotes.test.tsx frontend/src/components/pacotes/SaldoBadge.tsx
git commit -m "feat: build Pacotes page with monthly filter, sale modal and balance"
```

---

### Task 6: Validação `is_pacote` no serializer — **[DIOGO]**

> **Agente: PARE AQUI.** Esta task é do Diogo pelo contrato de aprendizado do `CLAUDE.md` (regra de Pacote Fidelidade). Não escreva o código; o plano descreve o comportamento esperado para ele implementar e para você revisar depois.

**Files:**

- Modify: `backend/core/serializers.py` (`PacoteContratadoSerializer.validate`)
- Test: `backend/tests/test_api_pacotes.py`

**Comportamento esperado:** `POST /api/pacotes/` com um `servico` cujo `is_pacote` é `False` deve devolver **400**, não 201. Hoje passa: nada impede registrar um "Banho avulso" como Pacote Fidelidade, e o `valor_pago` desse registro entra no faturamento como venda de pacote (invariante 1), corrompendo o número do mês.

**Onde:** no `validate()` que já existe, ao lado da checagem de duplicidade — a regra é do mesmo tipo (consistência do pacote), e o `CLAUDE.md` manda encapsular regra de pacote no model/serializer, nunca espalhar pela view.

**Trade-offs a considerar:**

- **No serializer** (recomendado): roda em POST e PATCH, mensagem de erro legível, e o teste é de API. Não protege quem escreve pelo `admin` do Django nem por script.
- **No `clean()` do model**: protege também o admin, mas o DRF não chama `full_clean()` por padrão — precisaria de um `validate()` chamando `instance.full_clean()`, o que é mais indireto.
- **Constraint de banco**: impossível sem desnormalizar `is_pacote` para dentro do `PacoteContratado` (constraint não faz JOIN), e desnormalizar contraria a modelagem fechada.

**Teste que fecha o buraco** (escreva-o antes da implementação):

- Um pacote com `ServicoFactory(is_pacote=False)` deve devolver 400 no POST.
- O caso feliz (`is_pacote=True`) continua devolvendo 201 — os testes existentes já cobrem, mas rode-os para garantir que a validação nova não é agressiva demais.

Depois de implementar, me chame para revisar o diff.

---

### Task 7: Relatório didático e PR

**Files:**

- Create: `estudos/PR-13-front-pacotes.md` (pasta não versionada)

- [ ] **Step 1: Escrever o relatório**

Formato dos anteriores (`estudos/PR-12-*.md`): nome do PR, tarefas feitas e **justificativa de cada escolha**. Público: dev júnior querendo explicar o código numa entrevista. Cobrir obrigatoriamente:

- Por que a invalidação de `pacote-ativo` é o detalhe que impede a dupla contagem no faturamento.
- Por que os dois `useRef` no `PacoteForm` pulam o disparo de montagem (invariantes 5 e 7).
- Por que `ultimoDiaDoMes` usa `Date.UTC` e `formatarData` não passa por `Date` (bug de fuso).
- Por que `pet` e `competencia` travam na edição (chave única).
- Por que não existe "excluir venda" (o `ativo` não tira do faturamento; o `PROTECT` bloqueia o DELETE).

- [ ] **Step 2: Abrir o PR**

```bash
git push -u origin feat/front-pacotes
gh pr create --title "PR 13: Pacotes" --body "Venda de pacote, saldo por pet e validade editável. Fecha o fluxo do pré-vínculo automático do PR 12."
```

Sem trailer de coautoria, sem selo de IA no corpo do PR.

---

## Ordem e dependências

Task 1 (backend) → Task 2 (tipos/hooks) → Task 3 (utilitários) → Task 4 (form) → Task 5 (página) → Task 6 [DIOGO] → Task 7 (relatório/PR).

As tasks 2 e 3 são independentes entre si e podem trocar de ordem. A Task 4 depende das duas. A Task 6 é independente do frontend e pode ser feita em paralelo pelo Diogo.
