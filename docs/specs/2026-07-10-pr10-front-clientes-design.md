# PR 10 · `feat/front-clientes` — Design doc

> Data: 2026-07-10. Aprovado por Diogo em sessão de brainstorming.
> Fontes: design doc do projeto (`2026-07-02-petdash-plan-design.md`), design doc do PR 9 (`2026-07-09-pr9-front-scaffold-design.md`), API real do backend (PRs 4–7), protótipo Lovable "Pet Grooming Dashboard".

## Objetivo

Primeira fatia vertical de dados reais do frontend: Clientes & Pets. Lista de tutores com busca, cadastro e edição de tutor e pet, detalhe do pet com histórico de atendimentos e badge VIP. O PR abre com duas adições read-only no backend, sem as quais o badge e o histórico não têm de onde tirar dado.

## Decisões desta sessão

| Decisão | Escolha | Racional |
|---|---|---|
| Navegação | **3 rotas**: `/clientes` → `/clientes/:id` → `/pets/:id` | VIP e histórico são por pet (invariante 6). Cada tela tem um assunto só, e a tabela longa de histórico ganha espaço próprio |
| Fonte do badge VIP | **Annotation no backend**, exposta no `PetSerializer` | A regra fica numa fonte só, testada em pytest. Calcular em JS duplicaria regra de negócio e quebraria com paginação |
| Janela do VIP | **Últimos 365 dias** | O critério (3+ visitas OU R$500) é frouxo: com banho a R$60–95, quem vem uma vez por mês bate os dois limites num trimestre. Sem janela, em dois anos todo pet ativo é VIP e o badge vira ruído |
| Formulários | **Modal**, reusado por 4 fluxos | Patricia não perde o contexto da lista ao cadastrar. O componente serve os PRs 11–14 |
| Primitivo do modal | **`@radix-ui/react-dialog`**; `porte` e tutor em `<select>` nativo | Honra a decisão do PR 9 ("Radix pontual quando a a11y for complexa"). Focus trap é código sutil; `<select>` nativo já é acessível, e Radix Select resolveria estética, não a11y |
| Contrato de aprendizado | **Claude implementa e testa tudo**, Diogo revisa o diff | Dispensa explícita de Diogo para a annotation VIP. Em contrapartida, `estudos/PR-10-*.md` detalha a annotation a fundo |

## Rotas

| Rota | Conteúdo |
|---|---|
| `/clientes` | Lista paginada de tutores, busca por nome/telefone, botão "Novo tutor" |
| `/clientes/:id` | Dados do tutor, editar, desativar, cards dos pets (cada um com badge VIP), botão "Novo pet" |
| `/pets/:id` | Dados do pet, badge VIP, editar, desativar, tabela paginada do histórico |

Breadcrumb `Clientes / Ana Clara / Luna` amarra os três níveis.

## Backend

### `services.anota_vip(queryset, hoje)`

Recebe um queryset de `Pet` e devolve o mesmo queryset com `qtd_visitas`, `total_gasto` e `vip` anotados na janela de 365 dias que termina em `hoje`. Critério da invariante 6: `qtd_visitas >= 3 OR total_gasto >= 500`, contando só atendimentos com status `Liberado`.

Não substitui `pets_vip(inicio, fim)`, que continua servindo o dashboard. São duas perguntas diferentes: "este pet é VIP hoje" e "quem foi VIP no período consultado".

**O ponto que decide se funciona:** a agregação precisa ser condicional (`Count("atendimentos", filter=Q(...))`), nunca um `.filter(atendimentos__status=...)` sobre o queryset. Com `.filter()` no join, o Django emite `INNER JOIN` e **todo pet sem atendimento na janela desaparece da lista de clientes**. Com `filter=` dentro do `Count`/`Sum`, o join continua `LEFT OUTER` e o pet aparece com zero. `Sum` precisa de `Coalesce(..., Decimal("0"))` para não devolver `None`.

`Count` e `Sum` na mesma `annotate` não se multiplicam porque percorrem uma só relação (`atendimentos`). Se alguém acrescentar uma segunda relação a essa `annotate`, aparece produto cartesiano. Comentar isso no código.

### `PetSerializer`

Ganha `vip`, `qtd_visitas` e `total_gasto` como read-only.

Sutileza: `get_queryset()` cobre `list`, `retrieve`, `update` e `partial_update`, mas **não** o `create`, cujo objeto nasce sem annotation. Um `BooleanField(read_only=True)` estoura com `AttributeError` no POST. A solução é `SerializerMethodField` com `getattr(obj, "vip", False)`. Os defaults (`False`, `0`, `0`) são semanticamente corretos para um pet recém-criado.

### `AtendimentoSerializer`

Ganha `servico_nome` (`source="servico.nome"`, read-only), espelhando o `tutor_nome` que o `PetSerializer` já tem. O `queryset` do `AtendimentoViewSet` já faz `select_related("servico")`, então não há N+1. Sem esse campo, o histórico precisaria de um segundo request só para traduzir ids.

O histórico distingue consumo de pacote de avulso por `pacote != null` (invariante 2), nunca por valor zero.

### `seed_dev`

Management command com guard `if not settings.DEBUG: raise CommandError`. Popula tutores, pets, serviços e atendimentos. Escrito com ORM puro, não com `factory_boy`: a lib vive só em `requirements-dev.txt`, e um comando de app importando de `tests/` acoplaria código de produção à suíte. Não é o seed do catálogo real, que é do PR 16.

## Frontend

```text
frontend/src/
  components/ui/        Modal (Radix Dialog), Select, Paginacao   [novos]
  components/           EstadoVazio, ErroAoCarregar               [novos]
  components/clientes/  TutorForm, PetForm, PetCard, HistoricoTabela
  hooks/                useTutores.ts, usePets.ts, useAtendimentos.ts
  lib/types.ts          Tutor, Pet, Atendimento, Paginated<T>
  pages/                Clientes, TutorDetalhe, PetDetalhe
```

Estrutura **por camada**, como o PR 9 decidiu (`features/` fica para quando doer). Os hooks do TanStack Query vivem em `hooks/`, um arquivo por recurso; `components/clientes/` é agrupamento por domínio dentro da camada de componentes, ao lado de `ui/` e `layout/`.

`ui/Select` é o wrapper do `<select>` **nativo** com label e erro, espelhando o `Input` de hoje. Nada de Radix Select.

Endpoints consumidos, todos já existentes: `GET /api/tutores/?search=&page=`, `GET /api/pets/?tutor=<id>`, `GET /api/pets/<id>/`, `GET /api/atendimentos/?pet=<id>&page=`, mais `POST`/`PATCH`/`DELETE` em `tutores` e `pets`.

Não haverá `Table` genérico: três tabelas de formatos diferentes não pagam a abstração, e o protótipo já define o markup (`rounded-2xl border`, cabeçalho em caixa alta com tracking largo, tile quadrado com a inicial, `hover:bg-cream/50`, números em `font-data`).

Busca com debounce de 300ms e `placeholderData: keepPreviousData`, para a lista não piscar a cada tecla. Mutations invalidam as query keys afetadas.

### Paginação

O DRF responde `{count, next, previous, results}` com `PAGE_SIZE=50` e sem `page_size_query_param`. O componente `Paginacao` lê `count` e `next` e oferece Anterior/Próxima com "página X de Y". Sem ele, um pet com dois anos de banho semanal mostraria só os 50 atendimentos mais recentes **sem avisar**, que é o pior tipo de bug: truncar em silêncio.

### Dívida do PR 9 quitada aqui

Dois dos cinco itens deixam de ser teóricos neste PR:

- **`lib/queryClient.ts`**: `/clientes/:id` dispara tutor e pets em paralelo. Dois 401 no mesmo tick viram dois `window.location.assign("/login")`. Resolve com uma flag booleana module-level.
- **`components/ui/Input.tsx`**: `id ?? props.name` gera `undefined` quando o caller não passa nenhum dos dois. O `Select` novo e os campos via `Controller` caem nesse caso. Resolve com `useId()` como fallback.

Os outros três (normalização de headers no `api.ts`, favicon de 875KB, `oxlint` órfão) não são tocados por este PR.

## Testes

**pytest** (`tests/test_api_cadastros.py`):

- `vip=True` por 3 visitas Liberadas; `vip=True` por R$500; `vip=False` para o pet comum.
- **Pet sem atendimento nenhum aparece na lista** com `vip=False`. É o teste que trava o `INNER JOIN`.
- Atendimento de 400 dias atrás não conta para a janela.
- Atendimento `Pendente` e `Cancelado` não contam.
- `POST /api/pets/` responde `vip=False` sem estourar (objeto não anotado).
- `servico_nome` presente em `GET /api/atendimentos/?pet=<id>`.

**Vitest/RTL com MSW**:

- Lista renderiza tutores; digitar na busca envia `?search=`.
- Estado vazio quando `count == 0`.
- Modal abre, valida com zod, submete e invalida a query.
- Badge VIP só aparece quando `vip: true`.
- Histórico marca o consumo de pacote quando `pacote != null`.
- Paginação avança para a página 2.
- Desativar pede confirmação antes de disparar o DELETE.

## Incoerência aceita

O badge do pet olha 365 dias; o dashboard olha o período consultado. O mesmo pet pode ser VIP numa tela e não na outra. Unificar exigiria a tela de cadastro escolher um período arbitrário, o que é pior. Fica registrado para não ser lido como bug.

O `total_gasto` soma `Atendimento.valor` inclusive de consumo de pacote. Como o valor nunca é zerado (invariante 2), um pacote de R$220 com 4 banhos de R$60 contabiliza R$240 de "gasto", superestimando o quanto o cliente pagou. O dashboard já se comporta assim; manter é coerência, não bug.

## Fora de escopo

Reativar tutor ou pet desativado (só pelo admin do Django) · catálogo de serviços (PR 11) · combobox com busca para escolher pet (PR 12) · busca global e demais itens do backlog · normalização de headers do `api.ts`, favicon e `oxlint` órfão.
