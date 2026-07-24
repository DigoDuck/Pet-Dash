# PR 20 · `feat/pets-alertas` — Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA — usar `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** listar pets na tela de Clientes por um switch Tutores/Pets, e registrar três condições no
cadastro do pet (agressivo, otite, problema de pele) que aparecem como badge nas listas e como aviso na
criação de atendimento — com o `agressivo` pré-marcando o `manejo_especial`.

**Arquitetura:** três `BooleanField` em `Pet` (migration 0007) expostos no `PetSerializer`. O frontend
lê os flags do payload que a busca de pets já devolve, sem request novo: o `petSelecionado` do
`AtendimentoForm` passa a carregá-los, e um componente `AlertasDoPet` renderiza a lista de avisos. A
listagem ganha um hook `usePets` paginado e duas tabelas extraídas do `Clientes.tsx`.

**Stack:** Django 5 + DRF + pytest-django/factory_boy no backend; React 19 + Vite + react-hook-form +
TanStack Query + Vitest/RTL/MSW no frontend.

**Spec:** `docs/specs/2026-07-24-pr20-pets-alertas-design.md`

## Constraints globais

- Branch: `feat/pets-alertas`, criada a partir de `main`. **Não commitar em `main`** — push na `main`
  dispara deploy na Railway e na Vercel (`docs/deploy.md:36`).
- Mensagens de commit em **português**, sem trailer de coautoria ou assinatura de IA.
- `ruff check .` (dentro de `backend/`) e a suíte completa passam antes de fechar o PR.
- **Invariante 7 do `CLAUDE.md`:** `Atendimento.valor` é o snapshot do que foi cobrado. Nada neste PR
  pode recalcular `valor` fora de ação explícita da usuária na criação.
- Nenhuma lógica de sugestão de preço em `useEffect`. Só em handler de evento.
- `manejo_especial` continua sendo o **único** flag que toca no valor. `otite` e `problema_pele` são
  aviso puro.
- Nomes de campo exatos, backend e frontend: `agressivo`, `otite`, `problema_pele`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
| --- | --- | --- |
| `backend/core/models.py` | Três `BooleanField` em `Pet` | Modificar |
| `backend/core/migrations/0007_pet_agressivo_pet_otite_pet_problema_pele.py` | Migration | Criar |
| `backend/core/serializers.py` | Campos no `PetSerializer` | Modificar |
| `backend/core/admin.py` | Flags no `list_filter` do `PetAdmin` | Modificar |
| `backend/tests/test_api_cadastros.py` | Teste de gravação/leitura dos flags | Modificar |
| `frontend/src/lib/types.ts` | `Pet` ganha os três campos | Modificar |
| `frontend/src/hooks/usePets.ts` | `PetEntrada` + hook `usePets` paginado | Modificar |
| `frontend/src/hooks/useTutores.ts` | `useTutores` aceita `enabled` | Modificar |
| `frontend/src/components/clientes/PetForm.tsx` | Três checkboxes | Modificar |
| `frontend/src/components/clientes/PetForm.test.tsx` | Teste do form | Criar |
| `frontend/src/pages/PetDetalhe.tsx` | `inicial` completo + badges | Modificar |
| `frontend/src/components/clientes/BadgesPet.tsx` | Badges de condição (3 call sites) | Criar |
| `frontend/src/components/clientes/PetCard.tsx` | Usa `BadgesPet` | Modificar |
| `frontend/src/components/atendimentos/AlertasDoPet.tsx` | Banner de avisos | Criar |
| `frontend/src/pages/AtendimentoForm.tsx` | Propagação dos flags | Modificar |
| `frontend/src/pages/AtendimentoForm.test.tsx` | Três testes novos | Modificar |
| `frontend/src/components/clientes/TabelaTutores.tsx` | Tabela de tutores extraída | Criar |
| `frontend/src/components/clientes/TabelaPets.tsx` | Tabela de pets | Criar |
| `frontend/src/pages/Clientes.tsx` | Switch de aba + composição | Modificar |
| `frontend/src/pages/Clientes.test.tsx` | Testes da aba | Modificar |
| `estudos/PR-20-pets-alertas.md` | Relatório didático | Criar |

---

## Task 1: Backend — os três flags em `Pet`

**Arquivos:**

- Modificar: `backend/core/models.py:30-35`
- Criar: `backend/core/migrations/0007_pet_agressivo_pet_otite_pet_problema_pele.py`
- Modificar: `backend/core/serializers.py:23-29`
- Modificar: `backend/core/admin.py:21-25`
- Teste: `backend/tests/test_api_cadastros.py`

**Interfaces:**

- Produz: `Pet.agressivo`, `Pet.otite`, `Pet.problema_pele` (`BooleanField`, `default=False`), todos
  graváveis via `POST`/`PATCH` em `/api/pets/` e presentes na resposta do serializer.

- [ ] **Passo 1: Confirmar a branch**

A branch já existe e carrega a spec e este plano. Confirmar antes de editar qualquer código:

```bash
git branch --show-current
```

Esperado: `feat/pets-alertas`. Se sair `main`, rodar `git checkout feat/pets-alertas` — **nenhum**
commit deste PR pode cair na `main`, que é o gatilho do deploy.

- [ ] **Passo 2: Escrever o teste que falha**

Adicionar ao final de `backend/tests/test_api_cadastros.py`:

```python
def test_cria_pet_com_condicoes(api):
    """Os três flags são graváveis no create e voltam na resposta."""
    tutor = TutorFactory()

    resp = api.post(
        "/api/pets/",
        {
            "tutor": tutor.id,
            "nome": "Thor",
            "agressivo": True,
            "otite": True,
            "problema_pele": True,
        },
    )

    assert resp.status_code == 201
    assert resp.json()["agressivo"] is True
    assert resp.json()["otite"] is True
    assert resp.json()["problema_pele"] is True


def test_pet_nasce_sem_condicoes(api):
    """default=False: pet cadastrado sem os campos não vira agressivo por omissão."""
    tutor = TutorFactory()

    resp = api.post("/api/pets/", {"tutor": tutor.id, "nome": "Luna"})

    assert resp.json()["agressivo"] is False
    assert resp.json()["otite"] is False
    assert resp.json()["problema_pele"] is False


def test_patch_desmarca_condicao(api):
    """Otite tratada some da ficha — o PATCH precisa aceitar voltar para False."""
    pet = PetFactory(otite=True)

    resp = api.patch(f"/api/pets/{pet.id}/", {"otite": False})

    assert resp.status_code == 200
    assert resp.json()["otite"] is False
    pet.refresh_from_db()
    assert pet.otite is False
```

- [ ] **Passo 3: Rodar o teste e confirmar que falha**

```bash
cd backend
pytest tests/test_api_cadastros.py::test_cria_pet_com_condicoes -v
```

Esperado: FAIL. `resp.json()` não tem a chave `agressivo` (`KeyError`).

- [ ] **Passo 4: Adicionar os campos ao model**

Em `backend/core/models.py`, dentro de `class Pet`, logo após `porte` (linha 33) e antes de `ativo`:

```python
    # Condições que a Patricia precisa ver ANTES de atender, não durante. `agressivo`
    # pré-marca o `manejo_especial` na criação do atendimento (é default, não trava);
    # os outros dois são aviso puro e não tocam em valor nenhum.
    agressivo = models.BooleanField(default=False)
    otite = models.BooleanField(default=False)
    problema_pele = models.BooleanField(default=False)
```

- [ ] **Passo 5: Gerar a migration**

```bash
cd backend
python manage.py makemigrations core
```

Esperado: `Migrations for 'core': core/migrations/0007_....py - Add field agressivo to pet ...`

Se o nome gerado não for `0007_pet_agressivo_pet_otite_pet_problema_pele.py`, aceitar o nome que o
Django escolheu — o importante é ser a 0007 e conter os três `AddField`.

- [ ] **Passo 6: Expor no serializer**

Em `backend/core/serializers.py`, na `Meta` do `PetSerializer`, trocar a lista `fields`:

```python
        fields = [
            "id", "tutor", "tutor_nome", "nome", "raca", "porte", "ativo",
            "agressivo", "otite", "problema_pele",
            "created_at", "vip", "qtd_visitas", "total_gasto",
        ]
```

`read_only_fields` **não** muda: os três são graváveis.

- [ ] **Passo 7: Rodar os testes e confirmar que passam**

```bash
cd backend
pytest tests/test_api_cadastros.py -v
```

Esperado: PASS em todos, incluindo os três novos.

- [ ] **Passo 8: Rodar a suíte inteira e o lint**

```bash
cd backend
pytest -q
ruff check .
```

Esperado: toda a suíte verde, `All checks passed!`.

- [ ] **Passo 9: Commit**

```bash
git add backend/core/models.py backend/core/migrations/ backend/core/serializers.py backend/tests/test_api_cadastros.py
git commit -m "feat: adiciona agressivo, otite e problema de pele ao cadastro de pet"
```

---

## Task 2: Frontend — tipos e formulário do pet

**Arquivos:**

- Modificar: `frontend/src/lib/types.ts:19-31`
- Modificar: `frontend/src/hooks/usePets.ts:5-10`
- Modificar: `frontend/src/components/clientes/PetForm.tsx`
- Modificar: `frontend/src/pages/PetDetalhe.tsx:102`
- Criar: `frontend/src/components/clientes/PetForm.test.tsx`

**Interfaces:**

- Consome: os campos da Task 1.
- Produz: `Pet.agressivo`, `Pet.otite`, `Pet.problema_pele` (`boolean`) em `lib/types.ts`; os mesmos três
  em `PetEntrada` (`hooks/usePets.ts`). O `PetForm` envia os três em toda submissão.

- [ ] **Passo 1: Escrever o teste que falha**

Criar `frontend/src/components/clientes/PetForm.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderizarComProvedores } from "../../test/utils";
import { PetForm } from "./PetForm";

describe("PetForm", () => {
  it("envia as três condições marcadas", async () => {
    const aoSalvar = vi.fn();

    renderizarComProvedores(
      <PetForm tutorId={3} aoSalvar={aoSalvar} enviando={false} aoCancelar={() => {}} />,
    );

    await userEvent.type(screen.getByLabelText("Nome"), "Thor");
    await userEvent.click(screen.getByLabelText(/agressivo/i));
    await userEvent.click(screen.getByLabelText(/otite/i));
    await userEvent.click(screen.getByLabelText(/problema de pele/i));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    expect(aoSalvar.mock.calls[0][0]).toMatchObject({
      tutor: 3,
      nome: "Thor",
      agressivo: true,
      otite: true,
      problema_pele: true,
    });
  });

  // Sem os três no defaultValues, o React troca input não-controlado por controlado ao
  // editar um pet antigo, e o payload sai com `undefined` no lugar de `false`.
  it("pet sem condições envia false, nunca undefined", async () => {
    const aoSalvar = vi.fn();

    renderizarComProvedores(
      <PetForm tutorId={3} aoSalvar={aoSalvar} enviando={false} aoCancelar={() => {}} />,
    );

    await userEvent.type(screen.getByLabelText("Nome"), "Luna");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    expect(aoSalvar.mock.calls[0][0]).toMatchObject({
      agressivo: false,
      otite: false,
      problema_pele: false,
    });
  });

  // A ficha do pet passa `inicial`; se um campo faltar ali, o PATCH manda `false` e
  // apaga em silêncio a condição que já estava gravada.
  it("respeita os flags recebidos em `inicial`", async () => {
    const aoSalvar = vi.fn();

    renderizarComProvedores(
      <PetForm
        tutorId={3}
        inicial={{ nome: "Thor", raca: "Pastor", porte: "G", agressivo: true, otite: false, problema_pele: true }}
        aoSalvar={aoSalvar}
        enviando={false}
        aoCancelar={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    expect(aoSalvar.mock.calls[0][0]).toMatchObject({
      agressivo: true,
      otite: false,
      problema_pele: true,
    });
  });
});
```

- [ ] **Passo 2: Rodar o teste e confirmar que falha**

```bash
cd frontend
npm run test -- src/components/clientes/PetForm.test.tsx
```

Esperado: FAIL — `Unable to find a label with the text of: /agressivo/i`.

- [ ] **Passo 3: Adicionar os campos ao type `Pet`**

Em `frontend/src/lib/types.ts`, na `interface Pet`, após `ativo: boolean;`:

```ts
  agressivo: boolean;
  otite: boolean;
  problema_pele: boolean;
```

- [ ] **Passo 4: Adicionar os campos a `PetEntrada`**

Em `frontend/src/hooks/usePets.ts`:

```ts
export interface PetEntrada {
  tutor: number;
  nome: string;
  raca: string;
  porte: Porte;
  agressivo: boolean;
  otite: boolean;
  problema_pele: boolean;
}
```

- [ ] **Passo 5: Adicionar os checkboxes ao `PetForm`**

Substituir o conteúdo de `frontend/src/components/clientes/PetForm.tsx` por:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { PetEntrada } from "../../hooks/usePets";
import { PORTES } from "../../lib/types";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const schema = z.object({
  nome: z.string().min(1, "Informe o nome"),
  raca: z.string(),
  porte: z.enum(["", "P", "M", "G"]),
  agressivo: z.boolean(),
  otite: z.boolean(),
  problema_pele: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface PetFormProps {
  tutorId: number;
  inicial?: Omit<PetEntrada, "tutor">;
  aoSalvar: (dados: PetEntrada) => void;
  enviando: boolean;
  aoCancelar: () => void;
}

export function PetForm({ tutorId, inicial, aoSalvar, enviando, aoCancelar }: PetFormProps) {
  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    // Os três booleans precisam estar aqui: sem valor inicial o input nasce
    // não-controlado e o payload sai com `undefined` no lugar de `false`.
    defaultValues: inicial ?? {
      nome: "", raca: "", porte: "",
      agressivo: false, otite: false, problema_pele: false,
    },
  });

  return (
    <form
      onSubmit={handleSubmit((dados) => aoSalvar({ ...dados, tutor: tutorId }))}
      className="flex flex-col gap-4"
      noValidate
    >
      <Input label="Nome" error={formState.errors.nome?.message} {...register("nome")} />
      <Input label="Raça" error={formState.errors.raca?.message} {...register("raca")} />
      <Select label="Porte" error={formState.errors.porte?.message} {...register("porte")}>
        {PORTES.map((p) => (
          <option key={p.valor} value={p.valor}>
            {p.rotulo}
          </option>
        ))}
      </Select>

      {/* Só o `agressivo` chega a mexer em dinheiro: ele pré-marca o manejo especial na
          criação do atendimento (+40% na sugestão). Otite e pele são aviso puro. */}
      <Checkbox label="Pet agressivo / precisa de contenção" {...register("agressivo")} />
      <Checkbox label="Tem otite" {...register("otite")} />
      <Checkbox label="Tem problema de pele" {...register("problema_pele")} />

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

- [ ] **Passo 6: Completar o `inicial` na ficha do pet**

Em `frontend/src/pages/PetDetalhe.tsx:102`, trocar a prop `inicial` do `PetForm`:

```tsx
          inicial={{
            nome: pet.data.nome,
            raca: pet.data.raca,
            porte: pet.data.porte,
            agressivo: pet.data.agressivo,
            otite: pet.data.otite,
            problema_pele: pet.data.problema_pele,
          }}
```

Sem isto, editar a raça de um pet agressivo manda `agressivo: false` no PATCH e apaga a marcação
sem nenhum aviso.

- [ ] **Passo 7: Rodar os testes e confirmar que passam**

```bash
cd frontend
npm run test -- src/components/clientes/PetForm.test.tsx
```

Esperado: 3 testes PASS.

- [ ] **Passo 8: Rodar a suíte do frontend inteira**

```bash
cd frontend
npm run test
```

Esperado: tudo verde. Se algum teste existente quebrar por falta dos campos novos em fixture de pet,
adicionar `agressivo: false, otite: false, problema_pele: false` ao objeto da fixture.

- [ ] **Passo 9: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/hooks/usePets.ts frontend/src/components/clientes/PetForm.tsx frontend/src/components/clientes/PetForm.test.tsx frontend/src/pages/PetDetalhe.tsx
git commit -m "feat: campos de condicao no formulario de pet"
```

---

## Task 3: Atendimento — aviso e pré-marcação do manejo

> Tarefa de maior risco do PR: mexe no caminho que sugere preço. Os testes dos passos 1 e 2 são o
> contrato; não avançar sem eles falhando pelo motivo certo.

**Arquivos:**

- Criar: `frontend/src/components/atendimentos/AlertasDoPet.tsx`
- Modificar: `frontend/src/pages/AtendimentoForm.tsx:39-43`, `:80`, `:125-132`, `:195`
- Modificar: `frontend/src/pages/AtendimentoForm.test.tsx:36-46`

**Interfaces:**

- Consome: `Pet.agressivo`, `Pet.otite`, `Pet.problema_pele` da Task 2.
- Produz: `AlertasDoPet({ agressivo: boolean, otite: boolean, problemaPele: boolean })` — retorna `null`
  quando nenhum flag está ligado.

- [ ] **Passo 1: Estender o helper de fixture dos testes**

Em `frontend/src/pages/AtendimentoForm.test.tsx`, substituir `petsOk` (linhas 36-46):

```tsx
function petsOk(porte = "", flags: Partial<Record<"agressivo" | "otite" | "problema_pele", boolean>> = {}) {
  return http.get(`${BASE}/pets/`, () =>
    HttpResponse.json({
      count: 1, next: null, previous: null,
      results: [{
        id: 7, tutor: 1, tutor_nome: "Ana Clara", nome: "Luna", raca: "", porte,
        ativo: true, created_at: "", vip: false, qtd_visitas: 0, total_gasto: "0.00",
        agressivo: false, otite: false, problema_pele: false, ...flags,
      }],
    }),
  );
}
```

- [ ] **Passo 2: Escrever os três testes que falham**

Adicionar **no fim** do `describe("AtendimentoForm", ...)`, depois do último teste existente
(`"pet com pacote saldo 0 cai em avulso com aviso"`). O terceiro teste usa `atendimentoExistente` e
`renderizarEdicao`, declaradas no meio do arquivo — colocar os três antes disso quebraria a compilação
por uso antes da declaração.

```tsx
  // O flag do pet é o motivo de o PR existir: ela não pode depender de lembrar que o
  // Thor morde. Pré-marcar sem trazer os 40% junto seria pior que não pré-marcar —
  // o checkbox diria "+40%" e o valor sugerido estaria sem eles.
  it("pet cadastrado como agressivo pré-marca o manejo e já sugere com os 40%", async () => {
    server.use(servicosComFaixas(), petsOk("P", { agressivo: true }));

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await screen.findByRole("option", { name: "Banho" });
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "1");
    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("65.00"));

    await escolherLuna();

    expect(await screen.findByText(/cadastrado como agressivo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Manejo especial/)).toBeChecked();
    // 65 × 1,4 = 91. Se `sugerirValor` receber o `manejoEspecial` velho do watch, fica 65.
    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("91.00"));
  });

  it("otite e problema de pele avisam sem tocar no manejo nem no valor", async () => {
    server.use(servicosComFaixas(), petsOk("P", { otite: true, problema_pele: true }));

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await screen.findByRole("option", { name: "Banho" });
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "1");
    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("65.00"));

    await escolherLuna();

    expect(await screen.findByText(/otite/i)).toBeInTheDocument();
    expect(screen.getByText(/problema de pele/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Manejo especial/)).not.toBeChecked();
    expect(screen.getByLabelText("Valor do serviço")).toHaveValue("65.00");
  });

  // Invariante 7 de novo, pelo caminho novo. Ela abre um atendimento antigo de pet
  // agressivo em que cobrou sem acréscimo; pré-marcar aqui marcaria o checkbox e
  // reescreveria o valor histórico numa ação que era só "corrigir o horário".
  it("abrir a edição de pet agressivo não marca o manejo nem mexe no valor", async () => {
    server.use(
      servicosComFaixas(),
      petsOk("G", { agressivo: true }),
      http.get(`${BASE}/atendimentos/42/`, () => HttpResponse.json(atendimentoExistente())),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () => new HttpResponse(null, { status: 204 })),
    );

    renderizarEdicao();

    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("150.00"));
    await screen.findByRole("option", { name: "Banho" });
    await new Promise((r) => setTimeout(r, 50));

    expect(screen.getByLabelText(/Manejo especial/)).not.toBeChecked();
    expect(screen.getByLabelText("Valor do serviço")).toHaveValue("150.00");
    expect(screen.queryByText(/cadastrado como agressivo/i)).not.toBeInTheDocument();
  });
```

- [ ] **Passo 3: Rodar os testes e confirmar que falham**

```bash
cd frontend
npm run test -- src/pages/AtendimentoForm.test.tsx
```

Esperado: os três novos FAIL. O primeiro por `Unable to find an element with the text
/cadastrado como agressivo/i`. Os testes antigos continuam PASS.

- [ ] **Passo 4: Criar o componente de alertas**

Criar `frontend/src/components/atendimentos/AlertasDoPet.tsx`:

```tsx
interface AlertasDoPetProps {
  agressivo: boolean;
  otite: boolean;
  problemaPele: boolean;
}

/** Avisos do cadastro do pet, exibidos na CRIAÇÃO do atendimento. Lista filtrada em vez
 *  de três blocos condicionais: condição nova é uma linha aqui, não um `&&` novo no JSX
 *  do formulário. */
export function AlertasDoPet({ agressivo, otite, problemaPele }: AlertasDoPetProps) {
  const alertas = [
    agressivo && "Este pet foi cadastrado como agressivo — manejo especial já marcado (+40%).",
    otite && "Este pet tem otite — cuidado com o ouvido no banho.",
    problemaPele && "Este pet tem problema de pele — atenção ao produto do banho.",
  ].filter((a): a is string => typeof a === "string");

  if (alertas.length === 0) return null;

  return (
    <div className="rounded-lg border border-erro/30 bg-erro/5 p-4">
      <p className="text-sm font-medium text-escuro">Alertas deste pet</p>
      <ul className="mt-1 list-disc pl-5 text-sm text-neutro">
        {alertas.map((alerta) => (
          <li key={alerta}>{alerta}</li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Passo 5: Estender o state `petSelecionado`**

Em `frontend/src/pages/AtendimentoForm.tsx`, substituir a declaração das linhas 39-43:

```tsx
  const [petSelecionado, setPetSelecionado] = useState<{
    id: number;
    rotulo: string;
    porte: Porte;
    agressivo: boolean;
    otite: boolean;
    problema_pele: boolean;
  } | null>(null);
```

- [ ] **Passo 6: Completar o `setPetSelecionado` da edição**

Na mesma página, linha 80 (dentro do `useEffect` que hidrata o form ao editar), trocar por:

```tsx
      // Na edição os flags ficam em `false` de propósito: o payload do atendimento não os
      // traz, e o banner é ferramenta de decisão na criação. Igual ao PacoteAtivoBanner,
      // que também só existe lá.
      setPetSelecionado({
        id: existente.data.pet,
        rotulo: existente.data.pet_nome,
        porte: "",
        agressivo: false,
        otite: false,
        problema_pele: false,
      });
```

- [ ] **Passo 7: Propagar os flags no `escolherPet`**

Substituir a função `escolherPet` (linhas 125-132):

```tsx
  function escolherPet(item: { id: number; rotulo: string } | null) {
    const pet = buscaPets.data?.results.find((p) => p.id === item?.id);
    const porte = pet?.porte ?? "";
    // Pet cadastrado como agressivo entra com o manejo já marcado. É default, não trava:
    // ela desmarca se o pet veio manso e o preço acompanha pelo onChange do checkbox.
    const agressivo = pet?.agressivo ?? false;
    setPetSelecionado(
      item
        ? {
            ...item,
            porte,
            agressivo,
            otite: pet?.otite ?? false,
            problema_pele: pet?.problema_pele ?? false,
          }
        : null,
    );
    setCobrarAvulso(false); // novo pet volta ao default seguro
    setValue("pet", item?.id ?? 0);
    setValue("manejo_especial", agressivo);
    // `agressivo`, e NÃO o `manejoEspecial` do watch: o watch ainda carrega o valor
    // anterior neste tick. Passar o velho deixaria o checkbox marcado com o preço sem os
    // 40% — erro que não aparece na tela e sangra dinheiro em todo atendimento do Thor.
    sugerirValor(servicoAtual, porte, agressivo);
  }
```

- [ ] **Passo 8: Renderizar o banner**

Adicionar o import no topo do arquivo, junto dos outros de `components/atendimentos`:

```tsx
import { AlertasDoPet } from "../components/atendimentos/AlertasDoPet";
```

E inserir o bloco logo **antes** do `PacoteAtivoBanner` (linha 193), dentro do `<form>`:

```tsx
        {!editando && petSelecionado && (
          <AlertasDoPet
            agressivo={petSelecionado.agressivo}
            otite={petSelecionado.otite}
            problemaPele={petSelecionado.problema_pele}
          />
        )}
```

- [ ] **Passo 9: Rodar os testes e confirmar que passam**

```bash
cd frontend
npm run test -- src/pages/AtendimentoForm.test.tsx
```

Esperado: todos PASS, inclusive os quatro testes de invariante que já existiam
("abrir a edição preserva o valor cobrado", "editar um consumo de pacote sem saldo preserva o vínculo",
"editar um avulso não o vincula ao pacote atual", "manejo especial acrescenta 40%").

- [ ] **Passo 10: Commit**

```bash
git add frontend/src/components/atendimentos/AlertasDoPet.tsx frontend/src/pages/AtendimentoForm.tsx frontend/src/pages/AtendimentoForm.test.tsx
git commit -m "feat: avisa condicoes do pet e pre-marca manejo no novo atendimento"
```

---

## Task 4: Badges de condição nas fichas

**Arquivos:**

- Criar: `frontend/src/components/clientes/BadgesPet.tsx`
- Modificar: `frontend/src/components/clientes/PetCard.tsx:13-28`
- Modificar: `frontend/src/pages/PetDetalhe.tsx:60-63`

**Interfaces:**

- Consome: `Pet` da Task 2.
- Produz: `BadgesPet({ pet: Pet })` — fragmento com as badges ligadas; usado por `PetCard`,
  `PetDetalhe` e (na Task 5) `TabelaPets`.

- [ ] **Passo 1: Criar o componente**

Criar `frontend/src/components/clientes/BadgesPet.tsx`:

```tsx
import type { Pet } from "../../lib/types";
import { Badge } from "../ui/Badge";

/** Badges de estado e condição do pet. Três call sites (card do tutor, ficha do pet,
 *  tabela da aba Pets); repetir a lista nos três é onde a quarta condição seria
 *  esquecida em dois deles. */
export function BadgesPet({ pet }: { pet: Pet }) {
  return (
    <>
      {pet.vip && <Badge variant="vip">VIP</Badge>}
      {pet.agressivo && <Badge variant="erro">Agressivo</Badge>}
      {pet.otite && <Badge variant="pendente">Otite</Badge>}
      {pet.problema_pele && <Badge variant="pendente">Pele</Badge>}
    </>
  );
}
```

- [ ] **Passo 2: Usar no `PetCard`**

Substituir `frontend/src/components/clientes/PetCard.tsx` por:

```tsx
import { Link } from "react-router-dom";
import type { Pet } from "../../lib/types";
import { Card } from "../ui/Card";
import { BadgesPet } from "./BadgesPet";

const ROTULOS_PORTE: Record<Pet["porte"], string> = {
  "": "Porte não informado",
  P: "Pequeno",
  M: "Médio",
  G: "Grande",
};

export function PetCard({ pet }: { pet: Pet }) {
  return (
    <Link to={`/pets/${pet.id}`} className="block">
      <Card className="transition-colors hover:border-ouro/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-escuro">{pet.nome}</p>
            <p className="text-xs text-neutro">
              {pet.raca || "Sem raça definida"} · {ROTULOS_PORTE[pet.porte]}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <BadgesPet pet={pet} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
```

- [ ] **Passo 3: Usar na ficha do pet**

Em `frontend/src/pages/PetDetalhe.tsx`, substituir o bloco das linhas 60-63:

```tsx
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl text-escuro">{pet.data.nome}</h1>
            <BadgesPet pet={pet.data} />
          </div>
```

E trocar o import do `Badge` pelo do `BadgesPet` (o `Badge` cru deixa de ser usado no arquivo):

```tsx
import { BadgesPet } from "../components/clientes/BadgesPet";
```

Remover a linha `import { Badge } from "../components/ui/Badge";`.

- [ ] **Passo 4: Rodar a suíte e confirmar que passa**

```bash
cd frontend
npm run test
```

Esperado: tudo verde. `PetDetalhe.test.tsx` e `TutorDetalhe.test.tsx` exercitam esses componentes; se
alguma fixture de pet nesses arquivos não tiver os campos novos, o TypeScript acusa — adicionar
`agressivo: false, otite: false, problema_pele: false`.

- [ ] **Passo 5: Commit**

```bash
git add frontend/src/components/clientes/BadgesPet.tsx frontend/src/components/clientes/PetCard.tsx frontend/src/pages/PetDetalhe.tsx
git commit -m "feat: badges de condicao no card e na ficha do pet"
```

---

## Task 5: Aba Pets na listagem de Clientes

**Arquivos:**

- Modificar: `frontend/src/hooks/useTutores.ts:13-22`
- Modificar: `frontend/src/hooks/usePets.ts`
- Criar: `frontend/src/components/clientes/TabelaTutores.tsx`
- Criar: `frontend/src/components/clientes/TabelaPets.tsx`
- Modificar: `frontend/src/pages/Clientes.tsx`
- Modificar: `frontend/src/pages/Clientes.test.tsx`

**Interfaces:**

- Consome: `BadgesPet` da Task 4; `Pet` da Task 2.
- Produz: `usePets(busca: string, pagina: number, ativo?: boolean)` em `hooks/usePets.ts`;
  `useTutores(busca, pagina, ativo?)` com terceiro parâmetro opcional (default `true`).

- [ ] **Passo 1: Escrever os testes que falham**

Adicionar ao `describe("Clientes", ...)` em `frontend/src/pages/Clientes.test.tsx`:

```tsx
  function pet(id: number, nome: string, over: Record<string, unknown> = {}) {
    return {
      id, tutor: 3, tutor_nome: "Camila Souza", nome, raca: "SRD", porte: "M",
      ativo: true, created_at: "2026-01-01", vip: false, qtd_visitas: 0, total_gasto: "0.00",
      agressivo: false, otite: false, problema_pele: false, ...over,
    };
  }

  it("o switch troca a lista de tutores para pets", async () => {
    server.use(
      http.get(`${BASE}/tutores/`, () => HttpResponse.json(paginado([tutor(1, "Ana Clara")]))),
      http.get(`${BASE}/pets/`, () => HttpResponse.json(paginado([pet(7, "Thor")]))),
    );

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });
    await screen.findByText("Ana Clara");

    await userEvent.click(screen.getByRole("button", { name: "Pets" }));

    expect(await screen.findByRole("link", { name: /Thor/ })).toHaveAttribute("href", "/pets/7");
    expect(screen.queryByText("Ana Clara")).not.toBeInTheDocument();
  });

  it("a aba Pets mostra as badges de condição", async () => {
    server.use(
      http.get(`${BASE}/tutores/`, () => HttpResponse.json(paginado([tutor(1, "Ana Clara")]))),
      http.get(`${BASE}/pets/`, () =>
        HttpResponse.json(paginado([pet(7, "Thor", { agressivo: true, otite: true })])),
      ),
    );

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });
    await screen.findByText("Ana Clara");

    await userEvent.click(screen.getByRole("button", { name: "Pets" }));

    expect(await screen.findByText("Agressivo")).toBeInTheDocument();
    expect(screen.getByText("Otite")).toBeInTheDocument();
    expect(screen.queryByText("Pele")).not.toBeInTheDocument();
  });

  // A busca da aba de tutores é nome+telefone; a de pets é nome do pet + nome do tutor.
  // Carregar o termo de uma para a outra devolve "nenhum resultado" sem explicar por quê.
  it("trocar de aba limpa a busca e requisita a lista nova", async () => {
    const buscasPet: string[] = [];
    server.use(
      http.get(`${BASE}/tutores/`, () => HttpResponse.json(paginado([tutor(1, "Ana Clara")]))),
      http.get(`${BASE}/pets/`, ({ request }) => {
        buscasPet.push(new URL(request.url).searchParams.get("search") ?? "");
        return HttpResponse.json(paginado([pet(7, "Thor")]));
      }),
    );

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });
    await screen.findByText("Ana Clara");
    await userEvent.type(screen.getByLabelText("Buscar por nome ou telefone"), "Ana");

    await userEvent.click(screen.getByRole("button", { name: "Pets" }));

    await screen.findByRole("link", { name: /Thor/ });
    expect(screen.getByLabelText("Buscar por nome do pet ou tutor")).toHaveValue("");
    await waitFor(() => expect(buscasPet).toContain(""));
  });
```

- [ ] **Passo 2: Rodar os testes e confirmar que falham**

```bash
cd frontend
npm run test -- src/pages/Clientes.test.tsx
```

Esperado: os três novos FAIL com `Unable to find an accessible element with the role "button" and name "Pets"`.

- [ ] **Passo 3: Tornar as consultas desligáveis**

Em `frontend/src/hooks/useTutores.ts`, trocar `useTutores`:

```ts
/** `ativo` desliga a consulta quando a página está mostrando a outra aba: sem isso a
 *  lista escondida continua fazendo request a cada busca e a cada troca de página. */
export function useTutores(busca: string, pagina: number, ativo = true) {
  const params = new URLSearchParams({ page: String(pagina) });
  if (busca) params.set("search", busca);
  return useQuery({
    queryKey: chavesTutores.lista(busca, pagina),
    queryFn: () => request<Paginated<Tutor>>(`/tutores/?${params}`),
    enabled: ativo,
    // Sem isto a lista pisca em branco a cada tecla digitada na busca.
    placeholderData: keepPreviousData,
  });
}
```

Em `frontend/src/hooks/usePets.ts`, adicionar a chave de lista e o hook novo. Trocar `chavesPets`:

```ts
export const chavesPets = {
  raiz: ["pets"] as const,
  lista: (busca: string, pagina: number) => ["pets", "lista", busca, pagina] as const,
  doTutor: (tutorId: number) => ["pets", "doTutor", tutorId] as const,
  detalhe: (id: number) => ["pets", "detalhe", id] as const,
};
```

E adicionar, logo após `usePetsDoTutor`:

```ts
/** Listagem paginada da aba Pets. Não dá para reusar o `useBuscaPets`: ele tem
 *  `enabled: termo.length > 0` e devolveria lista vazia com a busca em branco, que é
 *  justamente o estado inicial da aba. */
export function usePets(busca: string, pagina: number, ativo = true) {
  const params = new URLSearchParams({ page: String(pagina) });
  if (busca) params.set("search", busca);
  return useQuery({
    queryKey: chavesPets.lista(busca, pagina),
    queryFn: () => request<Paginated<Pet>>(`/pets/?${params}`),
    enabled: ativo,
    placeholderData: keepPreviousData,
  });
}
```

- [ ] **Passo 4: Extrair a tabela de tutores**

Criar `frontend/src/components/clientes/TabelaTutores.tsx` com o markup que hoje vive em
`Clientes.tsx:76-105`:

```tsx
import { Link } from "react-router-dom";
import type { Tutor } from "../../lib/types";

export function TabelaTutores({ tutores }: { tutores: Tutor[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
            <th className="px-6 py-3 font-semibold">Tutor</th>
            <th className="px-2 py-3 font-semibold">Telefone</th>
            <th className="px-6 py-3 font-semibold">E-mail</th>
          </tr>
        </thead>
        <tbody>
          {tutores.map((tutor) => (
            <tr
              key={tutor.id}
              className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50"
            >
              <td className="px-6 py-4">
                <Link to={`/clientes/${tutor.id}`} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-marsala font-semibold text-creme">
                    {tutor.nome.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium text-escuro">{tutor.nome}</span>
                </Link>
              </td>
              <td className="px-2 py-4 font-mono text-neutro">{tutor.telefone}</td>
              <td className="px-6 py-4 text-neutro">{tutor.email || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Passo 5: Criar a tabela de pets**

Criar `frontend/src/components/clientes/TabelaPets.tsx`:

```tsx
import { Link } from "react-router-dom";
import type { Pet } from "../../lib/types";
import { BadgesPet } from "./BadgesPet";

const ROTULOS_PORTE: Record<Pet["porte"], string> = {
  "": "—",
  P: "Pequeno",
  M: "Médio",
  G: "Grande",
};

export function TabelaPets({ pets }: { pets: Pet[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
            <th className="px-6 py-3 font-semibold">Pet</th>
            <th className="px-2 py-3 font-semibold">Tutor</th>
            <th className="px-2 py-3 font-semibold">Porte</th>
            <th className="px-6 py-3 font-semibold">Alertas</th>
          </tr>
        </thead>
        <tbody>
          {pets.map((pet) => (
            <tr
              key={pet.id}
              className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50"
            >
              <td className="px-6 py-4">
                <Link to={`/pets/${pet.id}`} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-marsala font-semibold text-creme">
                    {pet.nome.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium text-escuro">{pet.nome}</span>
                </Link>
              </td>
              <td className="px-2 py-4 text-neutro">{pet.tutor_nome}</td>
              <td className="px-2 py-4 text-neutro">{ROTULOS_PORTE[pet.porte]}</td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  <BadgesPet pet={pet} />
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

- [ ] **Passo 6: Montar o switch na página**

Substituir `frontend/src/pages/Clientes.tsx` por:

```tsx
import { useEffect, useState } from "react";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { EstadoVazio } from "../components/EstadoVazio";
import { PetsVip } from "../components/clientes/PetsVip";
import { TabelaPets } from "../components/clientes/TabelaPets";
import { TabelaTutores } from "../components/clientes/TabelaTutores";
import { TopTutores } from "../components/clientes/TopTutores";
import { TutorForm } from "../components/clientes/TutorForm";
import { Bloco } from "../components/ui/Bloco";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Paginacao } from "../components/ui/Paginacao";
import { useDashboard } from "../hooks/useDashboard";
import { usePets } from "../hooks/usePets";
import { useCriarTutor, useTutores } from "../hooks/useTutores";
import { inicioDaCompetencia, mesCorrente, ultimoDiaDoMes } from "../lib/competencia";

type Aba = "tutores" | "pets";

export function Clientes() {
  const [aba, setAba] = useState<Aba>("tutores");
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);

  // Debounce: sem isto, cada tecla vira um request. keepPreviousData segura a
  // lista anterior na tela enquanto o novo termo carrega.
  useEffect(() => {
    const id = setTimeout(() => {
      setBusca(texto);
      setPagina(1);
    }, 300);
    return () => clearTimeout(id);
  }, [texto]);

  const tutores = useTutores(busca, pagina, aba === "tutores");
  const pets = usePets(busca, pagina, aba === "pets");
  const criar = useCriarTutor();

  // Mesma chave que o Dashboard usa no mês corrente: a resposta vem do cache, sem
  // request novo, se a Patricia passou pelo painel antes de abrir os clientes.
  const mes = mesCorrente();
  const destaques = useDashboard(inicioDaCompetencia(mes), ultimoDiaDoMes(mes));

  // A busca não sobrevive à troca de aba: em Tutores ela casa nome+telefone do dono, em
  // Pets casa nome do pet + nome do dono. Levar o termo junto devolve "nada encontrado"
  // sem dizer por quê.
  function trocarAba(nova: Aba) {
    setAba(nova);
    setTexto("");
    setBusca("");
    setPagina(1);
  }

  const consulta = aba === "tutores" ? tutores : pets;
  const rotuloBusca =
    aba === "tutores" ? "Buscar por nome ou telefone" : "Buscar por nome do pet ou tutor";

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Clientes</h1>
        {/* Continua "Novo tutor" nas duas abas: pet só existe dentro de um dono, e a
            criação vive na ficha do tutor, onde o dono já está definido. */}
        <Button onClick={() => setModalAberto(true)}>Novo tutor</Button>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-sm grow">
          <Input
            label={rotuloBusca}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={aba === "tutores" ? "Ana, 71988..." : "Thor, Ana..."}
          />
        </div>
        <div className="flex rounded-lg border border-neutro-light/60 p-0.5" role="group">
          {(["tutores", "pets"] as const).map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => trocarAba(valor)}
              aria-pressed={aba === valor}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                aba === valor ? "bg-marsala text-creme" : "text-neutro hover:text-escuro"
              }`}
            >
              {valor === "tutores" ? "Tutores" : "Pets"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {consulta.isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => consulta.refetch()} />
        ) : consulta.isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : consulta.data.count === 0 ? (
          <EstadoVazio
            titulo={
              busca
                ? aba === "tutores"
                  ? "Nenhum cliente encontrado"
                  : "Nenhum pet encontrado"
                : aba === "tutores"
                  ? "Nenhum cliente ainda"
                  : "Nenhum pet ainda"
            }
            descricao={
              busca
                ? "Tente outro nome."
                : aba === "tutores"
                  ? "Cadastre o primeiro tutor para começar."
                  : "Os pets aparecem aqui depois de cadastrados na ficha do tutor."
            }
            acao={
              busca || aba === "pets" ? undefined : (
                <Button onClick={() => setModalAberto(true)}>Novo tutor</Button>
              )
            }
          />
        ) : (
          <>
            {aba === "tutores" ? (
              <TabelaTutores tutores={tutores.data!.results} />
            ) : (
              <TabelaPets pets={pets.data!.results} />
            )}
            <Paginacao pagina={pagina} count={consulta.data.count} aoMudar={setPagina} />
          </>
        )}
      </div>

      {/* Top tutores por gasto ao lado do VIP por pet: é a mitigação do ponto cego da
          invariante 6 (tutor com vários pets abaixo do limite nunca vira VIP sozinho).
          Vive aqui, e não no painel financeiro, porque a pergunta é sobre gente. */}
      <section className="mt-12">
        <h2 className="font-display text-2xl text-escuro">Destaques do mês</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <Bloco consulta={destaques} rotuloErro="Não foi possível carregar os tutores.">
            {(dados) => <TopTutores tutores={dados.top_tutores} />}
          </Bloco>
          <Bloco consulta={destaques} rotuloErro="Não foi possível carregar os pets VIP.">
            {(dados) => <PetsVip pets={dados.vip} />}
          </Bloco>
        </div>
      </section>

      <Modal aberto={modalAberto} titulo="Novo tutor" aoFechar={() => setModalAberto(false)}>
        <TutorForm
          enviando={criar.isPending}
          aoCancelar={() => setModalAberto(false)}
          aoSalvar={(dados) =>
            criar.mutate(dados, { onSuccess: () => setModalAberto(false) })
          }
        />
      </Modal>
    </div>
  );
}
```

> Sobre os `!` em `tutores.data!` e `pets.data!`: dentro do ramo já se sabe que
> `consulta.data` existe (os guards acima), mas o TypeScript não liga `consulta` de volta à consulta
> concreta. É a alternativa mais curta a duplicar os guards por aba.

- [ ] **Passo 7: Rodar os testes e confirmar que passam**

```bash
cd frontend
npm run test -- src/pages/Clientes.test.tsx
```

Esperado: todos PASS, inclusive os testes antigos da página.

- [ ] **Passo 8: Rodar a suíte inteira**

```bash
cd frontend
npm run test
npm run build
```

Esperado: testes verdes e build sem erro de TypeScript.

- [ ] **Passo 9: Commit**

```bash
git add frontend/src/hooks/useTutores.ts frontend/src/hooks/usePets.ts frontend/src/components/clientes/TabelaTutores.tsx frontend/src/components/clientes/TabelaPets.tsx frontend/src/pages/Clientes.tsx frontend/src/pages/Clientes.test.tsx
git commit -m "feat: switch entre listas de tutores e pets na tela de clientes"
```

---

## Task 6: Verificação final e relatório

**Arquivos:**

- Criar: `estudos/PR-20-pets-alertas.md`

- [ ] **Passo 1: Rodar a verificação completa**

```bash
cd backend && pytest -q && ruff check .
cd ../frontend && npm run test && npm run build
```

Esperado: as duas suítes verdes e o build limpo. **Colar a saída real no relatório** — sem evidência o
PR não está pronto (`CLAUDE.md`, regra 3 do fluxo de trabalho).

- [ ] **Passo 2: Conferir o fluxo no navegador**

```bash
cd backend && python manage.py runserver
# noutro terminal
cd frontend && npm run dev
```

Checar, nesta ordem:

1. `/clientes` → botão "Pets" troca a tabela; buscar "Thor" acha o pet pelo nome dele.
2. Ficha de um tutor → editar um pet → marcar "Pet agressivo" → salvar → badge "Agressivo" aparece.
3. `/atendimentos/novo` → escolher serviço → escolher esse pet → banner aparece, "Manejo especial"
   marcado, valor sugerido com os 40%.
4. Abrir um atendimento antigo desse mesmo pet para editar → checkbox **desmarcado**, valor intacto,
   sem banner.

- [ ] **Passo 3: Escrever o relatório didático**

Criar `estudos/PR-20-pets-alertas.md` seguindo o padrão dos anteriores (`estudos/PR-19-agenda.md`):
nome do PR, tarefas feitas, e **justificativa de cada escolha**. Cobrir no mínimo os pontos abaixo.

- Por que boolean por condição e não um campo `observacoes` de texto livre — e qual é o teto
  (quinta condição) em que essa escolha se inverte.
- Por que a pré-marcação vive em `escolherPet` e não num `useEffect`, com a ligação à invariante 7 e
  ao bug que o comentário de `AtendimentoForm.tsx:110-117` documenta.
- Por que `sugerirValor` recebe a variável `agressivo` e não o `manejoEspecial` do `watch` — o que é o
  closure velho do React e por que ele não aparece na tela.
- Por que os flags chegam pelo `petSelecionado` em vez de um request novo ou de campos no
  `AtendimentoSerializer`.
- Por que `enabled` nos dois hooks de lista em vez de deixar a aba escondida requisitando.
- Por que `PetDetalhe` precisou passar os três flags em `inicial` (o PATCH que apagaria a marcação).

- [ ] **Passo 4: Abrir o PR**

`estudos/` está no `.gitignore` (linha 42) — o relatório fica local, **não** entra em commit. Não tentar
`git add estudos/`.

```bash
git push -u origin feat/pets-alertas
gh pr create --base main --title "PR 20: aba de pets e alertas de condicao" --body "$(cat <<'EOF'
Fecha o pedido da Patricia de ver todos os pets cadastrados e de registrar condições que ela precisa
saber antes de atender.

## O que muda

- `Pet` ganha `agressivo`, `otite` e `problema_pele` (migration 0007, todos `default=False`).
- `/clientes` ganha um switch Tutores/Pets. A aba Pets busca por nome do pet **ou** do tutor, o que a
  busca de tutores não fazia.
- Pet marcado como agressivo pré-marca `manejo_especial` na criação do atendimento e já traz a sugestão
  de preço com os 40%. É default, não trava: ela desmarca se o pet veio manso.
- Banner "Alertas deste pet" na criação do atendimento, com as condições marcadas.

## Invariantes

`Atendimento.valor` continua sendo snapshot (invariante 7): a pré-marcação vive em `escolherPet`, nunca
em `useEffect`, e não acontece na edição. Teste dedicado trava isso. `otite` e `problema_pele` não tocam
em valor nenhum.

## Verificação

Backend: `pytest -q` + `ruff check .`. Frontend: `npm run test` + `npm run build`.
EOF
)"
```

---

## Fora de escopo (não implementar)

Filtro por condição na listagem · aba na URL · criar pet a partir da aba Pets · histórico de quando a
condição foi marcada · ligar `problema_pele` à regra dos +R$ 25 do banho medicinal · campo
`observacoes` de texto livre · mostrar os alertas na edição do atendimento.
