# PR 15 · `feat/front-dashboard` — Design doc

> Data: 2026-07-13. Aprovado por Diogo em sessão de brainstorming.
> Escopo do plano de projeto: "KPIs derivados, gráfico mensal, top tutores" (tamanho M).
> Fontes: `docs/specs/2026-07-02-petdash-plan-design.md`, invariantes 1, 6, 9 e 10 do `CLAUDE.md`,
> código dos PRs 7 e 14, protótipo Lovable (`src/routes/index.tsx`, "Painel financeiro").

## Contexto

`/` é o último `<EmConstrucao />` do app. Todo o resto da Fase 2 já entrega dado; falta a tela que
responde a pergunta que a planilha da Patricia responde mal: **o mês fechou bem, e está melhor ou pior
que os anteriores?**

O backend do PR 7 já entrega quase tudo. `GET /api/dashboard/?inicio&fim` devolve `faturamento`, `custos`,
`retiradas`, `lucro`, `ticket_medio`, `margem`, mais `vip[]` e `top_tutores[]`. Hoje a página Financeiro
consome só dois desses campos (`custos` e `retiradas`) e o resto é jogado fora.

O buraco é a **série mensal**: o endpoint agrega *um* período por vez. O gráfico de 6 meses não tem de onde
sair sem trabalho novo de backend.

O protótipo Lovable é a referência visual (grid de cards, barras pareadas em CSS, listas laterais), mas
metade do que ele mostra está fora do MVP por decisão fechada: saldo em caixa, meta mensal, transações
recentes e taxa de crescimento vs 2025 estão todos no backlog. Ele é referência de **layout e hierarquia**,
não de escopo.

## Decisões

1. **Endpoint novo `/api/dashboard/serie/?inicio&fim` para a série, em vez de 6 chamadas ao `/dashboard/`.**
   A alternativa descartada era `useQueries` chamando o endpoint atual uma vez por mês. Zero backend, mas
   cada chamada roda também `pets_vip` e `top_tutores` (as duas queries mais caras, com join em
   `atendimentos`) para o gráfico descartar 90% do payload. Seis vezes. Rota própria custa ~20 linhas e
   pede exatamente o que o gráfico usa.

2. **A série é um loop mês a mês reusando `faturamento_periodo`, não um `TruncMonth` com um `GROUP BY` só.**
   Este é o trade-off central do PR. O `GROUP BY` faria 3 queries em vez de 18 — mas reescreveria a regra da
   invariante 1 (`pacote_id IS NULL` + status `Liberado` + pacotes por `data_compra`) num segundo lugar.
   Se a regra mudar e alguém esquecer de mudar aqui, o gráfico e o KPI da mesma tela passam a discordar em
   silêncio, e o bug aparece como "o número de junho está diferente no card e na barra". Com usuária única e
   ~130 atendimentos/mês, 18 queries indexadas não são um problema; duas cópias da regra de faturamento são.
   Se o volume mudar de ordem de grandeza, a otimização continua disponível — e aí com o teste de
   equivalência já escrito para provar que as duas somam igual.

3. **A série tem rota própria; `custos_por_categoria` entra no `/dashboard/` existente.** Critério: quem
   paga a conta. A categoria é do mesmo período dos KPIs e custa um `GROUP BY` barato, então viaja junto.
   A série custa as 18 queries do item anterior — se ela viajasse no `/dashboard/`, a página **Financeiro**,
   que só quer dois totais, passaria a pagar o gráfico inteiro a cada carga de mês.

4. **`custos_por_categoria` agrupa por chave normalizada, não pelo texto cru.** `Custo.categoria` é
   `CharField(max_length=60, blank=True, default="")` — texto livre, sem `choices`, podendo vir vazio.
   Agrupar pelo valor cru faz "Aluguel", "aluguel" e "Aluguel " virarem três fatias do mesmo custo, e o
   custo sem categoria virar uma fatia sem nome. O `GROUP BY` usa `Lower(Trim(categoria))`, exibe o rótulo
   como digitado (via `Max(categoria)` do grupo), rotula o vazio como "Sem categoria" e corta em top 5 +
   "Outros". Não conserta o problema na origem (`categoria` continua texto livre), mas impede que o gráfico
   minta. Transformar `categoria` em `TextChoices` é mudança de model e fica fora deste PR.

5. **O gráfico mostra os 6 meses terminando no mês selecionado, não os 6 últimos a partir de hoje.**
   Selecionar junho mostra jan–jun com junho destacado. Um gráfico fixo em "hoje" enquanto os KPIs olham o
   mês escolhido faria duas partes da mesma tela falarem de períodos diferentes.

6. **Gráfico em CSS/Tailwind, sem biblioteca.** Barras são `div`s com `height` em porcentagem — é
   literalmente o que o protótipo Lovable faz. Recharts custaria ~100KB gzip de bundle por um gráfico de 12
   barras, num app 100% web cuja usuária tem máquina fraca, e ainda exigiria mockar `ResponsiveContainer`
   nos testes (jsdom não tem layout). O valor de cada barra vai como texto no DOM, então o RTL testa o
   gráfico lendo números, não pixels.

7. **Erro nunca vira zero.** Query falhou, o card mostra "—". Padrão já estabelecido pelo `ResumoMes` no
   PR 14: zero é um número, e um número errado numa tela de dinheiro é pior do que a ausência dele.

## Contrato de aprendizado

`services.serie_mensal()` é agregação de faturamento — cai em "manager/serviço de faturamento e saldo" e é
**do Diogo escrever**. Claude propõe a assinatura, aponta as armadilhas e revisa como sênior.

Todo o resto do PR (view, serializer, rota, `custos_por_categoria`, frontend inteiro, testes) é do Claude.

## Fatia de backend

### `services.serie_mensal(inicio, fim)`

Devolve uma linha por mês do intervalo, em ordem cronológica:

```python
[
    {"competencia": date(2026, 2, 1), "faturamento": Decimal("18200.00"),
     "custos": Decimal("7100.00"), "lucro": Decimal("11100.00")},
    ...
]
```

Armadilhas a cobrir na implementação:

- **Mês sem movimento existe e precisa aparecer.** Um mês sem nenhum atendimento nem custo é uma linha de
  zeros, não uma linha ausente. Se ele sumir, o gráfico cola março em maio e a leitura de tendência mente.
  Iterar sobre os meses do intervalo (e não sobre as linhas do banco) resolve isso por construção.
- **`lucro = faturamento - custos`**, coerente com `dashboard_periodo`. Retirada não entra: é distribuição
  de lucro, não despesa.
- **Custos casam por `competencia`, faturamento casa por data real.** São dois recortes diferentes do mesmo
  mês. O primeiro e o último dia do mês entram no cálculo de faturamento; a competência é sempre dia 1.
- **`ultimo_dia_do_mes` sem `timedelta` mágico:** `calendar.monthrange` ou "dia 1 do mês seguinte menos um
  dia". Dezembro→janeiro é o caso que quebra a versão ingênua.

### `services.custos_por_categoria(inicio, fim)`

`GROUP BY Lower(Trim(categoria))`, `Sum(valor)`, ordenado por valor desc, top 5 + linha "Outros" com a
soma da cauda. Vazio vira "Sem categoria". Devolve `[{"categoria": str, "valor": Decimal}]`.

### Exposição

| Rota | Muda o quê |
|---|---|
| `GET /api/dashboard/?inicio&fim` | Ganha o campo `custos_por_categoria` na resposta |
| `GET /api/dashboard/serie/?inicio&fim` | Nova. `SerieMensalView` + `PontoSerieSerializer` |

A validação dos parâmetros (`inicio`/`fim` obrigatórios, ISO, 400 com mensagem) é a mesma do
`DashboardView` — extrair para um helper compartilhado em vez de copiar o `try/except`.

### Testes de backend (`backend/tests/test_api_financeiro.py` e `test_services.py`)

1. `serie_mensal` devolve uma linha por mês do intervalo, **inclusive meses sem movimento** (zeros).
2. **Teste de equivalência:** para um mês qualquer, `serie_mensal[i].faturamento == dashboard_periodo(mês).faturamento`.
   É o teste que protege a decisão 2 — se um dia alguém trocar o loop por um `GROUP BY`, este teste é o que
   pega a divergência.
3. Consumo de pacote (`pacote_id` preenchido) **não** entra no faturamento do mês na série (invariante 1).
4. Venda de pacote entra pelo `data_compra`.
5. `custos_por_categoria` funde "Aluguel" e "aluguel " num grupo só, e rotula categoria vazia como
   "Sem categoria".
6. `GET /dashboard/serie/` sem `inicio`/`fim` devolve 400.

## Frontend

| Arquivo | Papel |
|---|---|
| `lib/types.ts` | `PontoSerie`, `CategoriaCusto`, `TopTutor`; `ResumoFinanceiro` ganha `vip`, `top_tutores`, `custos_por_categoria` |
| `lib/formato.ts` | `formatarPercentual` (fração `"0.6490"` → `"64,9%"`) e `formatarPrecoCurto` (`"23194.00"` → `"R$ 23,2k"`, para caber no rótulo da barra) |
| `lib/competencia.ts` | `mesesAnteriores(mes, n)` — os N meses terminando em `mes` |
| `hooks/useDashboard.ts` | Ganha `useSerieMensal(inicio, fim)` e a chave `["dashboard", "serie", …]` |
| `components/ui/KpiCard.tsx` | Extraído do `Total` privado do `ResumoMes`; `ResumoMes` passa a reusá-lo |
| `components/dashboard/GraficoMensal.tsx` | Barras pareadas faturamento × custos, 6 meses, mês selecionado destacado |
| `components/dashboard/CustosPorCategoria.tsx` | Barra empilhada + lista com % |
| `components/dashboard/TopTutores.tsx` | Lista de tutores por gasto no período |
| `components/dashboard/PetsVip.tsx` | Lista de pets VIP do período |
| `pages/Dashboard.tsx` | Substitui o `<EmConstrucao />`; `SeletorMes` + composição |

### Layout

Seguindo a hierarquia do protótipo, sem os blocos fora de escopo:

```text
Dashboard                                    [ SeletorMes ]
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│Faturamen.│  Custos  │  Lucro   │  Ticket  │ Retiradas│   ← 5 KpiCards
│          │          │ margem % │  médio   │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
┌───────────────────────────────┬─────────────────────┐
│  Faturamento × custos         │ Despesas por        │
│  (6 meses, barras)            │ categoria           │
└───────────────────────────────┴─────────────────────┘
┌───────────────────────────────┬─────────────────────┐
│  Top tutores do mês           │ Pets VIP            │
└───────────────────────────────┴─────────────────────┘
```

O lucro leva a margem como subtítulo ("Margem de 64,9%") em vez de virar um sexto card: são a mesma
informação em duas unidades.

### Estado e cache

Duas queries: `useDashboard(inicio, fim)` (já existe, reusado inteiro) e `useSerieMensal(inicio, fim)`. As
mutações de custo/retirada do PR 14 já invalidam a raiz `["dashboard"]`, e a chave da série nasce sob essa
raiz **de propósito** — lançar um custo em julho conserta o KPI e a barra de julho na mesma invalidação. Se
a série tivesse chave própria fora da raiz, o gráfico ficaria velho e ninguém perceberia.

Estados de carregando, erro e vazio por bloco, independentes: a série falhar não pode apagar os KPIs.

### Divisão por zero

Mês sem movimento nenhum zera todas as barras, e a altura é `valor / maxDaSerie`. Com `maxDaSerie == 0` o
cálculo vira `NaN` e o React renderiza `height: NaN%`. O denominador é `Math.max(...valores) || 1`. Vale o
mesmo para a margem (o backend já devolve `0` quando o faturamento é zero) e para os percentuais da barra
de categorias.

## Testes (Vitest + RTL + MSW)

1. A página busca `/dashboard/` e `/dashboard/serie/` com o intervalo do mês corrente e renderiza os 5 KPIs.
2. Trocar o mês refaz as duas consultas com o novo intervalo, e o gráfico passa a terminar no mês escolhido.
3. Lucro exibe a margem formatada como percentual a partir da fração vinda do backend.
4. `GraficoMensal` com série toda zerada não quebra nem produz `NaN` (o teste da divisão por zero).
5. `GraficoMensal` destaca a barra do mês selecionado.
6. Erro na query dos KPIs mostra "—", não "R$ 0,00".
7. Erro na série não derruba os KPIs (blocos independentes).
8. Top tutores e Pets VIP renderizam a partir do payload do `/dashboard/`; lista vazia mostra `EstadoVazio`.
9. `formatarPercentual` e `mesesAnteriores` (unitários, incluindo a virada de ano: `mesesAnteriores("2026-02", 6)` começa em setembro de 2025).

## Fora de escopo

Saldo em caixa · meta mensal · transações recentes · taxa de crescimento vs ano anterior (todos backlog
explícito) · exportar relatório · `categoria` como enum ou catálogo · comparativo com a planilha real
(oráculo de verificação, feito sob demanda) · qualquer valor financeiro materializado (invariante 9).
