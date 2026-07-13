# PR 14 · `feat/front-financeiro` — Design doc

> Data: 2026-07-13. Aprovado por Diogo em sessão de brainstorming.
> Escopo do plano de projeto: "Custos por competência + retiradas" (tamanho M).
> Fontes: `docs/specs/2026-07-02-petdash-plan-design.md`, invariantes 9 e 10 do `CLAUDE.md`, código dos PRs 7 e 13.

## Contexto

`Custo` e `Retirada` existem no banco desde o PR 3 e têm API desde o PR 7 (`/api/custos/`,
`/api/retiradas/`), mas nenhuma tela: `/financeiro` é um `<EmConstrucao />`. Hoje só o admin do Django
lança um custo. Sem esta página, o Dashboard do PR 15 mostraria lucro e margem calculados sobre uma base
de custos vazia — números certos sobre dados que ninguém consegue inserir.

O protótipo Lovable não tem esta tela (as duas telas mockadas são Painel financeiro e Agenda; o Painel
vira o Dashboard do PR 15). A UI segue os padrões já estabelecidos no repo: seletor de mês de
`Pacotes.tsx`, tabela + modal de `Servicos.tsx`, `window.confirm` de `TutorDetalhe.tsx`.

## Decisões

1. **Uma página, duas seções empilhadas, um seletor de mês.** Custos em cima, Retiradas embaixo, ambos
   governados pelo mesmo `<input type="month">`. Descartado abas: esconde metade do mês atrás de um
   clique e a Patricia lança as duas coisas na mesma sentada (fechamento do mês).
2. **Totais vêm do `/dashboard/`, não de soma no cliente.** Invariante 9: financeiro é derivado em query,
   nunca materializado — e somar as linhas da tabela seria "certo por acidente", correto só enquanto tudo
   couber na primeira página de 50 e mentindo em silêncio depois. O endpoint `/api/dashboard/?inicio&fim`
   já agrega `custos` e `retiradas` do período; a página consome só esses dois campos. O hook
   `useDashboard` nasce aqui e é reusado inteiro pelo PR 15.
3. **Exclusão é hard-delete, e a UI precisa dizer isso.** A invariante 11 (soft-delete) cobre só `Tutor` e
   `Pet`. `Custo` e `Retirada` não têm `ativo`: `DELETE` apaga a linha e muda o fechamento daquele mês. O
   `window.confirm` diz isso com todas as letras. Nenhuma FK aponta para essas tabelas, então não há risco
   de `ProtectedError` (diferente do pacote no PR 13).
4. **Retirada continua com `data`, não vira competência.** O texto da invariante 10 diz "custos e retiradas
   por competência mensal", mas o model tem `data` (dia real) e `dashboard_periodo` soma retiradas por
   `data__gte/lte`. Manter o model e filtrar por intervalo do mês mantém a tela e o dashboard olhando o
   mesmo número. Mudar o model contrariaria o backend já testado, e o ganho seria nenhum.
5. **Sem "copiar custos fixos do mês anterior".** Fora da spec. Poupa redigitação real (aluguel, água, luz
   repetem), mas é escopo extra e pede guarda contra duplicar. Se a dor aparecer no uso, entra no PR 16.

## Fatia de backend

Habilitadora, pequena, no molde do PR 13 (que adicionou filtros ao `PacoteContratadoViewSet`).

`RetiradaViewSet` (`backend/core/views.py`):

- `filterset_fields = {"data": ["exact", "gte", "lte"]}`. O `exact` **fica**: `test_filtra_retirada_por_data`
  já depende de `?data=2026-06-15`, e removê-lo faria o filtro virar no-op — o teste passaria a receber
  todas as retiradas.
- `queryset` ordenado por `("-data", "descricao")`.

`CustoViewSet`: `queryset` ordenado por `("-competencia", "descricao")`.

O desempate não é cosmético: `ORDER BY` só por mês deixa a ordem das linhas do mesmo mês indefinida no
Postgres, e a paginação pode repetir ou pular um lançamento entre requisições. Mesma correção que o
`PacoteContratadoViewSet` recebeu no PR 13.

Testes novos em `backend/tests/test_api_financeiro.py`: intervalo `?data__gte=&data__lte=` devolve só as
retiradas do mês (com uma retirada fora do intervalo para provar o recorte), e o filtro exato continua
funcionando.

## Frontend

| Arquivo | Papel |
|---|---|
| `lib/formato.ts` | `formatarPreco` extraído das 5 cópias existentes (Pacotes, Servicos, HistoricoTabela, AtendimentoTabela, PagamentosField) |
| `lib/types.ts` | `Custo`, `CustoEntrada`, `Retirada`, `RetiradaEntrada`, `ResumoFinanceiro` |
| `hooks/useCustos.ts` | `useCustos(competencia, tipo, pagina)`, `useCriarCusto`, `useAtualizarCusto`, `useExcluirCusto` |
| `hooks/useRetiradas.ts` | `useRetiradas(inicio, fim, pagina)`, `useCriarRetirada`, `useAtualizarRetirada`, `useExcluirRetirada` |
| `hooks/useDashboard.ts` | `useDashboard(inicio, fim)` — nasce aqui, o PR 15 reusa |
| `components/financeiro/ResumoMes.tsx` | Dois cards: custos e retiradas do mês |
| `components/financeiro/CustosSecao.tsx` | Tabela + filtro fixo/variável + modais |
| `components/financeiro/CustoForm.tsx` | Form de custo (criar e editar) |
| `components/financeiro/RetiradasSecao.tsx` | Tabela + modais |
| `components/financeiro/RetiradaForm.tsx` | Form de retirada (criar e editar) |
| `pages/Financeiro.tsx` | Substitui o `<EmConstrucao />`; seletor de mês e composição |

Cada seção guarda seu próprio estado de página e de modal. A página só decide o mês — sem isso ela viraria
o componente gordo que o `Pacotes.tsx` quase virou.

### Invalidação de cache (o detalhe que protege os números)

Toda mutação de custo ou retirada invalida **duas** chaves: a lista (`["custos"]` / `["retiradas"]`) e
`["dashboard"]`. Sem a segunda, criar um custo de R$ 300 atualiza a tabela e deixa o card "Custos do mês"
no valor antigo — a tela contradiz a si mesma na mesma dobra. É o análogo direto da armadilha do
`pacote-ativo` no PR 13, e o motivo de `invalidarFinanceiro()` ser uma função só, compartilhada pelos dois
hooks.

### Seção de custos

Cabeçalho "Custos" com botão "Novo custo" e filtro de tipo (Todos · Fixo · Variável) — o `WHERE tipo=` da
invariante 10 exposto na UI. Colunas: Descrição · Tipo (`Badge`) · Categoria · Valor · Ações (Editar,
Excluir). O filtro de tipo não altera o card de total, que é sempre o mês inteiro; o rótulo do card diz
"Custos do mês" justamente para não sugerir que acompanha o filtro.

### Seção de retiradas

Cabeçalho "Retiradas" com botão "Nova retirada". Colunas: Descrição · Tipo · Data · Valor · Ações. Sem
filtro além do mês — `Retirada.tipo` é texto livre, não enum; filtrar por ele exigiria enumerar valores
que o model não define.

### Forms

`CustoForm`: descrição (obrigatória), tipo (`Select` fixo/variável, obrigatório), valor (obrigatório, > 0),
categoria (texto livre, opcional), competência (`<input type="month">`, default = mês selecionado na
página, convertido para `YYYY-MM-01` no envio).

`RetiradaForm`: descrição (obrigatória), valor (obrigatório, > 0), data (default = hoje, dentro do mês
selecionado), tipo (texto livre, opcional).

Validação de descrição e valor no cliente (react-hook-form, como nos forms anteriores) para a Patricia não
esperar o round-trip por um campo vazio. Erro do DRF continua exibido no topo do modal via `mensagemDeErro`.

### Estados

Carregando, erro (`ErroAoCarregar`, com retry) e vazio (`EstadoVazio` com CTA de cadastro) por seção,
independentes: a falha da lista de custos não apaga as retiradas da tela.

## Testes (Vitest + RTL + MSW)

1. A página busca custos por `?competencia=` e retiradas por `?data__gte=&data__lte=` do mês corrente, e
   renderiza as duas tabelas.
2. Trocar o mês refaz as três consultas (custos, retiradas, dashboard) com o novo intervalo.
3. Os cards de total exibem os valores do `/dashboard/`, não a soma das linhas — teste com uma tabela cujo
   somatório é propositalmente diferente do total do endpoint.
4. Criar um custo invalida a chave `["dashboard"]` (guarda o item acima).
5. Excluir pede confirmação e não chama a API quando o usuário cancela.
6. Filtro fixo/variável requisita `?tipo=`.
7. `CustoForm` recusa valor zero e descrição vazia sem chamar a API.
8. `formatarPreco` (unitário).

## Fora de escopo

Copiar custos fixos do mês anterior · categorias como enum ou catálogo · gráfico de custos (PR 15) ·
lucro/margem nesta tela (PR 15) · anexo de comprovante · soft-delete de custo/retirada.
