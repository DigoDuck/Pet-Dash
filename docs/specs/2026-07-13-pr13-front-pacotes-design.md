# PR 13 · `feat/front-pacotes` — Design doc

> Data: 2026-07-13. Aprovado por Diogo em sessão de brainstorming.
> Escopo do plano de projeto: "Venda de pacote, saldo por pet, validade editável" (tamanho M).
> Fontes: `docs/specs/2026-07-02-petdash-plan-design.md`, invariantes 2 a 5 do `CLAUDE.md`, código dos PRs 6 e 12.

## Contexto

O `PacoteContratado` existe no banco desde o PR 3 e tem API desde o PR 6, mas o único caminho que o
frontend usa hoje é `GET /pets/:id/pacote-ativo/`, consumido pelo `AtendimentoForm` para pré-vincular
o `pacote_id`. Não existe tela para **vender** um pacote: a página `/pacotes` é um `<EmConstrucao />`.
Sem ela, o fluxo crítico do PR 12 nunca dispara — não há pacote ativo para o form encontrar.

O protótipo Lovable não tem tela de pacotes (só Painel e Agenda), então a UI segue os padrões já
estabelecidos no repo: página CRUD no molde de `Servicos.tsx`, form em modal, `Combobox` de pet do
`AtendimentoForm`.

## Decisões

1. **A página `/pacotes` é o único ponto de venda.** Sem atalho no `PetDetalhe` e sem oferta dentro do
   `AtendimentoForm`. O form de atendimento é o componente mais crítico do sistema (risco nº 2 do plano
   de projeto: vínculo errado fatura em dobro); não vale mexer nele para economizar dois cliques.
2. **Ações na lista: vender e editar.** A edição cobre a validade (mecanismo de reagendamento da
   invariante 5) e o valor pago (erro de digitação). **Sem excluir venda no MVP.** Motivo: o campo
   `PacoteContratado.ativo` *não* tira o pacote do faturamento — `faturamento_periodo` soma todos os
   pacotes por `data_compra`, sem filtrar `ativo`. Desfazer uma venda exigiria `DELETE`, que o `PROTECT`
   de `Atendimento.pacote` bloqueia com `ProtectedError` (hoje um 500 não tratado). Correção de venda
   errada fica pelo admin do Django até o PR 16.
3. **Enriquecer o backend em vez de cruzar dados no cliente.** A lista precisa de nome do pet e de filtro
   por mês; o ViewSet atual não oferece nenhum dos dois. Alternativa descartada: buscar `/pacotes/`
   inteiro e cruzar com `/pets/` no front — cresce sem limite e a máquina da Patricia é fraca.
4. **Venda em modal, não em página.** São seis campos. Página dedicada só se justifica com sub-forms
   (caso do `AtendimentoForm`, que tem `PagamentosField`).
5. **`validade` default = último dia da competência.** Coerente com a invariante 3 (cota mensal, não
   acumula). Permanece editável — é assim que o reagendamento é tratado.

## Fatia de backend

Habilitadora, pequena, no molde do commit `832de74` (que adicionou `pet_nome`/`tutor_nome` ao
`AtendimentoSerializer` durante o PR 12).

`PacoteContratadoViewSet` (`backend/core/views.py`):

- `filterset_fields = ["pet", "competencia"]`. `competencia` é `DateField` de match exato; o `save()` do
  model normaliza para o dia 1, então `?competencia=2026-07-01` sempre casa.
- `search_fields = ["pet__nome", "pet__tutor__nome"]`.
- `queryset` com `select_related("pet", "pet__tutor", "servico")`, senão os nomes no serializer viram N+1.

`PacoteContratadoSerializer` (`backend/core/serializers.py`): campos read-only `pet_nome`, `tutor_nome`,
`servico_nome`. O `saldo` já existe e continua derivado (invariante 4) — nada é materializado.

**Escrito pelo Diogo (contrato de aprendizado):** validação de que `servico.is_pacote` é verdadeiro no
`validate()` do serializer. Hoje nada impede vender um "Banho avulso" como pacote, o que corrompe o
faturamento. O front filtra o Select por `is_pacote=true`, mas isso é UI: um POST direto ainda passa.

Teste novo em `backend/tests/test_api_pacotes.py`: o filtro por competência devolve só os pacotes do mês,
e a resposta traz `pet_nome` e `saldo`.

## Frontend

| Arquivo | Papel |
|---|---|
| `lib/types.ts` | `Pacote` ganha `pet_nome`, `tutor_nome`, `servico_nome`; novo tipo `PacoteEntrada` |
| `hooks/usePacotes.ts` | `usePacotes(competencia, busca)`, `useCriarPacote()`, `useAtualizarPacote(id)` |
| `components/pacotes/PacoteForm.tsx` | Form de venda e de edição |
| `components/pacotes/SaldoBadge.tsx` | `3/4 créditos`, com variante visual para saldo zero |
| `pages/Pacotes.tsx` | Substitui o `<EmConstrucao />` |

### Invalidação de cache (o detalhe que protege o faturamento)

As mutations de pacote invalidam **duas** chaves: `["pacotes"]` e `["pacote-ativo"]`. Sem a segunda,
vender um pacote e ir direto ao `AtendimentoForm` mostraria o pet ainda sem pacote (cache velho do
`usePacoteAtivo`), o atendimento nasceria avulso e o dinheiro do pacote seria contado duas vezes —
exatamente o erro humano da planilha que o sistema existe para eliminar (invariantes 1 e 2).

### Página

Cabeçalho com título e botão "Vender pacote". Abaixo, seletor de competência (`<input type="month">`,
default mês corrente) e campo de busca por pet ou tutor, com debounce de 300 ms como em
`Servicos.tsx`/`Clientes.tsx`. Tabela: Pet · Tutor · Serviço · Saldo · Valor pago · Validade · Ações
(Editar). Estados de carregando, erro (`ErroAoCarregar`) e vazio (`EstadoVazio` com CTA de venda) seguem
os componentes já existentes. Paginação com o `Paginacao` (`PAGE_SIZE` 50 no DRF).

### Form

Campos: pet (`Combobox` com busca, igual ao `AtendimentoForm`), serviço (`Select` alimentado por
`useServicos` filtrado por `is_pacote=true`), competência, qtd_total, valor_pago, data_compra, validade.

Defaults ao escolher o serviço: `valor_pago = servico.preco_padrao` e `qtd_total = servico.creditos ?? 4`,
ambos editáveis (o `preco_padrao` é sugestão — invariante 7). `competencia` é `<input type="month">`
convertido para `YYYY-MM-01` no envio. `data_compra` = hoje. `validade` = último dia do mês da
competência, recalculada quando a competência muda.

Na edição, `pet` e `competencia` ficam travados: são a chave única, e trocá-los transformaria a edição
numa venda diferente disfarçada.

### Erros

O `UNIQUE(pet, competencia)` chega do DRF como `{"non_field_errors": ["Já existe um pacote para este pet
nesta competência."]}`. O `PacoteForm` lê `ApiError.detail` e exibe a mensagem no topo do modal. É o erro
mais provável no uso real (tentar vender duas vezes no mesmo mês); falhar em silêncio seria pior do que
não ter a tela.

## Testes (Vitest + RTL + MSW)

1. A lista requisita `?competencia=` do mês atual e renderiza saldo e nome do pet.
2. Escolher o serviço preenche valor e créditos; mudar a competência recalcula a validade.
3. Venda com sucesso fecha o modal e invalida a chave `pacote-ativo` (guarda a invariante de faturamento).
4. Venda duplicada exibe a mensagem de erro do backend dentro do modal.

## Fora de escopo

Excluir/cancelar venda · atalho de venda no `PetDetalhe` · oferta de pacote dentro do `AtendimentoForm` ·
histórico de pacotes de meses anteriores por pet (a lista já filtra por competência) · qualquer
materialização de saldo.
