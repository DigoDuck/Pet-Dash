# PR 11 · `feat/front-servicos` — Design doc

> Data: 2026-07-10. Aprovado por Diogo em sessão de brainstorming.
> Fontes: design doc do projeto (`2026-07-02-petdash-plan-design.md`), design/plano do PR 10 (padrão de lista, hooks, modal), API real do backend (PR 5).

## Objetivo

Catálogo de serviços: uma tela `/servicos` com lista, busca, criação e edição em modal, e ativar/desativar via `ativo`. PR de tamanho S, **100% frontend** — o backend de serviços (PR 5) já atende. Reusa a infra montada no PR 10 (`Modal`, `Input`, `Select`, `Paginacao`, `EstadoVazio`, `ErroAoCarregar`, padrão de hooks TanStack).

## Decisões desta sessão

| Decisão | Escolha | Racional |
|---|---|---|
| Tirar serviço do catálogo | **Ativar/Desativar via `ativo`**, sem DELETE na UI | FKs de `Atendimento`/`PacoteContratado` para `Servico` são `PROTECT`; hard-delete de serviço usado quebra. Desativar preserva o histórico e o pricing snapshot (invariante 7) |
| Campo `creditos` | **Condicional ao checkbox "é pacote?"** | `creditos` só faz sentido com `is_pacote=true`. Revelar o campo via `watch` evita crédito órfão em serviço avulso (invariante 3: pacote = 4 créditos/mês) |
| Estrutura | **Uma rota**, lista + modal CRUD, sem página de detalhe | Serviço é entidade rasa, sem histórico próprio. Segue o padrão da tela Clientes |
| Inativos | **Toggle "mostrar inativos"** (default: só ativos) | Sem isso, serviço desativado some para sempre da UI e só volta pelo admin |
| Busca | **Por nome, com debounce** | Backend já tem `search_fields=["nome"]`; reusa o padrão de Clientes |

## Backend: por que não muda

Nenhuma mudança de model, serializer, view ou migration.

- `ServicoSerializer` expõe `ativo` como campo **editável** (não está em `read_only_fields`): "desativar" é `PATCH {ativo:false}`, "reativar" é `PATCH {ativo:true}`.
- `ServicoViewSet` já tem `filterset_fields=["is_pacote","ativo"]` e `search_fields=["nome"]`: a lista filtra por `?ativo=true` e busca sem código novo.
- `queryset = Servico.objects.all().order_by("nome")`: ordenação pronta.

**Faca-no-chão consciente:** o `ServicoViewSet` não tem `perform_destroy` de soft-delete, então `DELETE` continua sendo hard-delete e quebraria por `PROTECT` num serviço usado. A UI **nunca aciona DELETE** (não há botão de excluir), então o caminho fica inacessível. Não mexo no backend (YAGNI); fica registrado para não ser lido como esquecimento.

## Frontend

```text
frontend/src/
  lib/types.ts                         + Servico, ServicoEntrada
  hooks/useServicos.ts                 [novo] queries + mutations
  components/ui/Checkbox.tsx           [novo] label + <input type="checkbox">, espelha o Input
  components/servicos/ServicoForm.tsx  [novo] form com créditos condicional
  pages/Servicos.tsx                   lista, busca, toggle inativos, modais
```

### Tipos (`lib/types.ts`)

```ts
export interface Servico {
  id: number;
  nome: string;
  preco_padrao: string;       // decimal como string, padrão DRF
  is_pacote: boolean;
  creditos: number | null;    // null quando não é pacote
  ativo: boolean;
}
```

`ServicoEntrada` = `{ nome, preco_padrao, is_pacote, creditos }` — os campos que o `ServicoForm` controla. O `ativo` **não** entra aqui: ele é alternado pelos botões desativar/reativar, não pelo form. A mutation de atualização aceita `Partial<Servico>`, cobrindo tanto o objeto do form quanto o `{ativo:false}` do toggle.

### Hooks (`hooks/useServicos.ts`)

- `useServicos(busca: string, incluirInativos: boolean)`: monta a query. Sempre `ordering` por nome (default do backend). Quando `incluirInativos` é `false`, adiciona `ativo=true`; quando `true`, omite o filtro (vêm ativos e inativos). `search` só quando `busca` não vazio. `placeholderData: keepPreviousData`.
- `useCriarServico()`: POST, invalida `["servicos"]`.
- `useAtualizarServico(id)`: PATCH. **Cobre os três casos** — editar (objeto do form), desativar (`{ativo:false}`), reativar (`{ativo:true}`) — porque todos são PATCH parcial. Invalida `["servicos"]`.

Query keys hierárquicas `chavesServicos = { raiz: ["servicos"], lista: (busca, incluirInativos) => [...] }`, como em `chavesTutores`.

### `Checkbox` (`components/ui/Checkbox.tsx`)

Componente novo, no padrão do `Input`: `label` + `<input type="checkbox">` nativo, com `useId()` como fallback de id e espalhando `...props` (para o `register` do react-hook-form). Serve o `ServicoForm` agora e o `transporte` do PR 12 depois.

### `ServicoForm` (a única peça com lógica real)

- Campos: `nome` (Input), `preco_padrao` (Input, numérico), `is_pacote` (Checkbox), `creditos` (Input, condicional).
- `watch("is_pacote")` do react-hook-form: o campo `creditos` **só renderiza quando marcado**.
- zod com `superRefine`:
  - `is_pacote=true` → `creditos` obrigatório e `>= 1` (default 4);
  - `is_pacote=false` → `creditos` forçado a `null` no envio.
- `preco_padrao` validado como decimal positivo (string que casa `/^\d+(\.\d{1,2})?$/`).
- `handleSubmit((dados) => aoSalvar(dados))` **envolvido** — o RHF passa o evento como 2º argumento ao callback direto (armadilha vista no PR 10).
- Controlado por quem chama: recebe `aoSalvar`, `enviando`, `aoCancelar`; não conhece mutation nem modal (testável sem MSW).

### Página `Servicos`

- Cabeçalho com "Novo serviço"; campo de busca (debounce 300ms); toggle "Mostrar inativos".
- Tabela (padrão Lovable do PR 10): nome, preço (`font-mono`), badge Avulso/Pacote, e badge de status só quando inativo. Linha de serviço inativo com opacidade reduzida.
- Ações por linha: "Editar" (abre modal) e "Desativar"/"Reativar" (PATCH direto, com `window.confirm` só na desativação).
- Estados: `EstadoVazio` (lista vazia, com e sem busca), `ErroAoCarregar`, "Carregando...", `Paginacao` (custo zero se couber em uma página).

## Testes

**Vitest/RTL com MSW** (`pages/Servicos.test.tsx`, `components/servicos/ServicoForm.test.tsx`, `components/ui/Checkbox.test.tsx`):

- Lista renderiza serviços; busca digitada envia `?search=`.
- Toggle "mostrar inativos" muda a presença de `ativo=true` na query.
- Criar pelo modal invalida a lista e fecha o modal.
- **Checkbox "é pacote" revela o campo créditos**; desmarcar o esconde.
- Validação: pacote sem créditos é rejeitado; avulso envia `creditos:null`.
- Desativar dispara `PATCH {ativo:false}`; reativar dispara `PATCH {ativo:true}`.
- `Checkbox`: associa label ao input, alterna estado, espelha erro.

**Sem pytest novo** — o backend não muda. A verificação final confirma a suíte backend intacta (`pytest`, `ruff`, `makemigrations --check`).

## Fora de escopo

Página de detalhe de serviço · hard-delete · seed de serviços (o `seed_dev` do PR 10 já cria Banho, Banho e Tosa e Pacote Fidelidade) · edição em massa · categorias de serviço.
