# PR 12 · `feat/front-atendimentos` — Design doc

> Data: 2026-07-11. Aprovado por Diogo em sessão de brainstorming.
> Fontes: design doc do projeto (`2026-07-02-petdash-plan-design.md`), specs/planos dos PRs 10–11, API real (PR 6), protótipo Lovable (tela Agenda → tabela "Próximos atendimentos").

## Objetivo

O PR mais crítico do frontend: registrar e listar atendimentos. Uma lista com filtros (data, status, pet) e um formulário em página dedicada cujo fluxo central é o **pré-vínculo automático do pacote** — a mitigação do risco número 1 do projeto (se o atendimento de um pet com pacote virar avulso, o faturamento conta o dinheiro em dobro). É também onde o **valor por atendimento** é definido (o preço que varia por pet, não fixo no catálogo).

## Decisões desta sessão

| Decisão | Escolha | Racional |
|---|---|---|
| Onde vive o form | **Página dedicada** (`/atendimentos/novo`, `/atendimentos/:id/editar`) | O form tem 8+ campos e sub-listas (pagamentos); modal apertaria demais |
| Vínculo de pacote | **Automático + banner, com link "cobrar avulso"** | O default seguro cobre o esquecimento humano (risco 1); a saída cobre o caso legítimo |
| Select de pet | **Combobox com busca** (via `/pets/?search=`) | ~89 pets num `<select>` nativo é ruim; busca é o gesto natural |
| Status | **No form (select) + ação rápida na lista** | Marcar "realizado" é o gesto diário; abrir o form inteiro para isso é atrito |
| Transporte | **Checkbox + valor condicional** | Campo do model (`transporte`, `transporte_valor`); mesmo padrão do créditos do PR 11 |
| Soma de pagamentos | **Validação ao vivo** + no submit | Feedback antecipado; o backend já valida `sum == valor` |
| Cancelar | **Com confirmação** | Cancelar devolve crédito ao pacote (invariante 4); ação que mexe em saldo |

## Backend: uma adição read-only

A lista mostra pet e tutor (protótipo: "Mel / Rafael Lima"), mas o `AtendimentoSerializer` só tem `servico_nome`. Espelhando o padrão do PR 10:

- `AtendimentoSerializer` ganha `pet_nome` (`source="pet.nome"`) e `tutor_nome` (`source="pet.tutor.nome"`), ambos read-only.
- `AtendimentoViewSet.get_queryset` troca `select_related("pet", ...)` por `select_related("pet__tutor", "servico", "pacote")` para evitar N+1 no `tutor_nome`.

Nenhuma outra mudança. Sem migration. O endpoint `GET /pets/:id/pacote-ativo/` e a validação de pagamentos (`sum(Pagamento.valor) == Atendimento.valor` para avulsos; saldo para pacote) já existem (PR 6).

**Fora**: badge VIP na lista de atendimentos (VIP é derivado do pet via annotation; trazê-lo ao `AtendimentoSerializer` complicaria o queryset sem servir ao fluxo).

## Frontend

```text
frontend/src/
  lib/types.ts                              + pet_nome/tutor_nome em Atendimento; + Pacote; + AtendimentoEntrada
  hooks/useAtendimentos.ts                  + useAtendimentos(filtros), useAtendimento(id),
                                              useCriarAtendimento, useAtualizarAtendimento
  hooks/usePacoteAtivo.ts        [novo]     usePacoteAtivo(petId) -> Pacote | null (204)
  components/ui/Combobox.tsx     [novo]     combobox com busca, teclado e ARIA
  components/atendimentos/
    AtendimentoTabela.tsx        [novo]     a lista (padrão Lovable)
    FiltrosAtendimento.tsx       [novo]     data, status, pet
    PagamentosField.tsx          [novo]     sub-form dinâmico (useFieldArray) + soma ao vivo
    PacoteAtivoBanner.tsx        [novo]     banner do pacote vinculado
    StatusAcao.tsx               [novo]     troca de status na linha (PATCH {status})
  pages/Atendimentos.tsx                    lista + filtros
  pages/AtendimentoForm.tsx      [novo]     form de criação/edição (novo e :id/editar)
```

### Tipos

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
```

`Atendimento` ganha `pet_nome: string` e `tutor_nome: string`. `AtendimentoEntrada` = payload de POST/PATCH: `{ pet, servico, pacote, data, horario, valor, transporte, transporte_valor, status, pagamentos }`.

### Combobox de pet (`components/ui/Combobox.tsx`)

Componente à mão (não há Radix Combobox estável; `cmdk`/`downshift` seriam dep nova grande). Genérico o suficiente para reuso:

- Um `<input role="combobox">` com `aria-expanded`, `aria-controls`; a lista é `role="listbox"` com `role="option"`.
- Busca via callback `aoBuscar(termo)` com debounce de 300ms (o caller liga em `/pets/?search=`).
- Teclado: `↓/↑` navegam (`aria-activedescendant`), `Enter` seleciona, `Esc` fecha. Clique fora fecha.
- Seleção guarda `{ id, rotulo }`; integra com react-hook-form via `Controller` (o form guarda o `pet` id).
- Estados: "buscando...", "nenhum pet encontrado".

Honestidade sobre a11y: cobre teclado e roles básicos, não é uma implementação de referência WAI-ARIA completa (foco/virtualização de listas longas ficam de fora — 89 pets não exigem). Se virar problema, migra para lib.

### O form e o fluxo de pacote (o núcleo)

Estado do form (react-hook-form): `pet, servico, data, horario, valor, transporte, transporte_valor, status, pagamentos[]`. Mais dois estados locais: `pacoteAtivo: Pacote | null` e `cobrarAvulso: boolean`.

Fluxo:

1. **Escolher serviço** dispara `setValue("valor", servico.preco_padrao)` — a sugestão editável. É aqui que o valor por pet acontece: a Patricia ajusta o número para o golden vs o pinscher.
2. **Escolher pet** dispara `usePacoteAtivo(petId)`. Resultado:
   - **pacote com `saldo > 0`** e `cobrarAvulso === false` → o form envia `pacote: pacote.id`; renderiza `PacoteAtivoBanner` ("Pacote Fidelidade · saldo 3/4 · consome 1 crédito") e **esconde `PagamentosField`** (consumo de pacote não tem pagamento — já foi pago na venda). Link "cobrar como avulso" seta `cobrarAvulso = true`.
   - **pacote com `saldo === 0`** → aviso "pacote sem saldo neste mês"; trata como avulso.
   - **sem pacote** (204) → avulso normal.
3. **Vínculo é o default seguro**: só vira avulso se não há pacote, o saldo é 0, ou a Patricia clicou "cobrar avulso".
4. **Trocar de pet reseta `cobrarAvulso` para `false`** e rebusca o pacote. Um novo pet começa sempre no default seguro; senão o "cobrar avulso" clicado para o pet A vazaria para o pet B e reintroduziria o risco.

Quando avulso, o form mostra `PagamentosField`. Quando pacote, não.

### Pagamentos (`PagamentosField`)

`useFieldArray` do react-hook-form: N linhas de `{ metodo, valor }`. Métodos: Pix, Cartao, Dinheiro. Adicionar/remover linhas. Um resumo ao vivo compara `sum(pagamentos.valor)` com `valor` do atendimento e mostra "confere" ou "falta R$X / sobra R$X". No submit, zod valida a igualdade (o backend revalida).

Regra: pagamentos são **opcionais** (um atendimento Pendente ainda não foi pago). Mas se houver ao menos um, a soma tem que bater. Espelha o backend.

### Lista, filtros e status

- `AtendimentoTabela`: colunas data+hora, pet/tutor (tile com inicial), serviço, origem (Avulso/Pacote), status (badge), valor. Ordenada por `-data, -horario` (default do backend).
- `FiltrosAtendimento`: data (input date), status (select: todos/Pendente/Liberado/Cancelado), pet (reusa o `Combobox`). Cada filtro vira query param.
- `StatusAcao` na linha: move Pendente→Liberado→Cancelado via PATCH `{status}`. **Cancelar** abre `window.confirm` (devolve crédito ao pacote, invariante 4).
- Paginação (`Paginacao`, ~130 atendimentos/mês estoura o PAGE_SIZE=50 em ~3 meses).

## Testes

**pytest** (`tests/test_api_atendimentos.py`):

- `pet_nome` e `tutor_nome` presentes em `GET /api/atendimentos/`.
- A lista não dispara N+1 (o `select_related("pet__tutor")` cobre) — asserção com `django_assert_num_queries`.

**Vitest/RTL com MSW**:

- `Combobox`: digitar busca; navegar com teclado; selecionar emite o id.
- Form: escolher serviço pré-preenche o valor.
- Form: escolher pet com pacote vincula (`pacote` no payload), mostra banner, esconde pagamentos.
- Form: "cobrar como avulso" desvincula e revela pagamentos.
- Form: pet com pacote saldo 0 cai em avulso com aviso.
- `PagamentosField`: soma que não bate mostra o aviso e bloqueia o submit.
- Lista: filtros enviam os query params; `StatusAcao` faz PATCH `{status}`; cancelar confirma antes.

## Fora de escopo

Agenda / calendário semanal (fase 2 do produto) · badge VIP na lista de atendimentos · edição de pacote (PR 13) · virtualização do combobox · reagendamento por regras (a `validade` editável do pacote é do PR 13).
