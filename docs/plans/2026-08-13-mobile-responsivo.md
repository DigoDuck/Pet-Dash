# Plano — PetDash responsivo para celular

Data: 2026-08-13 · Branch sugerida: `feat/mobile-responsivo`

## Objetivo

A Patricia quer usar o PetDash no celular quando estiver em casa. Premissa assumida:
**uso pleno, não só consulta.** Ela deve conseguir ver a semana, procurar um cliente,
olhar os números do mês e também lançar ou corrigir um atendimento, tudo do telefone.

Alvo real: **iPhone e Android em retrato, 390 px de largura** (iPhone 14/15 e a maioria
dos Androids atuais). Se funciona em 390, funciona em 360 (Android antigo) com folga
mínima; testar nos dois.

## O que NÃO entra

Fechado no `CLAUDE.md`, não reabrir sem perguntar:

- **Nada de PWA, service worker ou offline-first.** Está explicitamente no backlog.
- **Nada de app nativo ou codebase mobile separada.** É o mesmo build, mesma rota,
  mesma informação.
- **Nada de esconder funcionalidade no celular.** Se a coluna Ações some do alcance,
  isso é regressão, não adaptação.
- **Nada de mudar a arquitetura de informação.** Os mesmos 7 itens de menu, os mesmos
  nomes, na mesma ordem. Aprender duas navegações para o mesmo app é pior que rolar.

## Diagnóstico: o que quebra hoje

Levantamento no código atual. O app tem **17 usos de utilitário responsivo no total**,
concentrados em `Dashboard`, `TutorDetalhe`, `ResumoMes` e `GraficoMensal`. Todo o
resto foi escrito assumindo desktop.

### Bloqueadores (o app fica inutilizável, não só feio)

| # | Onde | O que acontece em 390 px |
|---|---|---|
| B1 | [Sidebar.tsx:78](frontend/src/components/layout/Sidebar.tsx#L78) | `w-[260px] shrink-0` sempre visível: o menu come **67% da largura da tela**. Sobram 130 px para o conteúdo. |
| B2 | [Modal.tsx:22](frontend/src/components/ui/Modal.tsx#L22) | Sem `max-height` e centralizado por `-translate-y-1/2`: formulário alto estoura para cima e para baixo, e **a parte de cima fica inalcançável** (não há scroll). Com o teclado aberto a viewport cai pela metade e isso vira o caso normal, não a exceção. Afeta todo cadastro e edição. |
| B3 | [Agenda.tsx:149](frontend/src/pages/Agenda.tsx#L149) | `grid min-w-180` = 720 px com 6–7 colunas. Em 390 px cada dia tem ~48 px: os cards de atendimento ficam ilegíveis mesmo com o scroll horizontal. |
| B4 | `Input`, `Select`, `Combobox` | Todos com `text-sm` (14px). **O iOS Safari dá zoom automático em qualquer campo abaixo de 16px** ao focar, e não desfaz o zoom ao sair. Ela toca no campo Pet e a tela inteira fica torta. |

### Sérios (dá para usar, mas com atrito real)

| # | Onde | Problema |
|---|---|---|
| S1 | 9 tabelas com `overflow-x-auto` | Rolam na horizontal, mas a coluna **Ações é a última**: Editar/Excluir/Liberar ficam permanentemente fora da tela. |
| S2 | [AtendimentoTabela.tsx](frontend/src/components/atendimentos/AtendimentoTabela.tsx) | 7 colunas. É a tabela mais usada (Atendimentos + Agenda). |
| S3 | 6× `grid grid-cols-2` sem breakpoint | `AtendimentoForm:270`, `PacoteForm:167,185`, `ServicoForm:87`, `CustoForm:81,95`, `RetiradaForm:77`. Dois campos lado a lado em ~170 px cada. |
| S4 | [Button.tsx](frontend/src/components/ui/Button.tsx) | `py-2` → ~36 px de altura. Abaixo dos 44 px de alvo de toque. Vale também para as setas da Agenda (`h-9 w-9`) e os links da Sidebar. |
| S5 | [FiltrosAtendimento.tsx:14,18](frontend/src/components/atendimentos/FiltrosAtendimento.tsx#L14) | Dois `w-44` fixos (176 px cada) + `gap-4` = 368 px. Cabe raspando em 390 e quebra em 360. |
| S6 | [AppShell.tsx:6](frontend/src/components/layout/AppShell.tsx#L6) | `min-h-screen` usa `100vh`, que no mobile inclui a área da barra de URL e gera overflow vertical. |

### O que já está certo (não mexer)

- O `<meta name="viewport">` existe e está correto em [index.html:5](frontend/index.html#L5).
- [SeletorMes.tsx](frontend/src/components/ui/SeletorMes.tsx) já trata `<input type="month">`
  não suportado com estado local + setas. **O iOS Safari também não suporta `type="month"`**,
  então a correção do Firefox já cobre o iPhone de graça. Não refazer.
- [Modal.tsx](frontend/src/components/ui/Modal.tsx) já usa `w-[min(28rem,calc(100vw-2rem))]`:
  a largura já é responsiva, só falta a altura.
- `Dashboard`, `ResumoMes` e `TutorDetalhe` já empilham por padrão (`sm:`/`lg:` aditivos
  sobre uma base de 1 coluna). É o padrão mobile-first correto; seguir esse exemplo.
- [GraficoMensal.tsx](frontend/src/components/dashboard/GraficoMensal.tsx) é feito com
  `div`, não com Recharts, e já tem `w-3 sm:w-4` nas barras. Cabe em 390 px.

## Breakpoints

**Não criar breakpoint customizado.** Os defaults do Tailwind coincidem com os pontos
onde o conteúdo deste app quebra, e o protótipo do Lovable usa exatamente `lg` para a
sidebar (`hidden lg:flex lg:w-[260px]` em `src/components/app-shell.tsx`).

| Breakpoint | Onde o conteúdo pede | O que muda |
|---|---|---|
| base (< 640) | 390 px, retrato | 1 coluna, menu em gaveta, tabelas reduzidas |
| `sm` (640) | dois campos de formulário lado a lado | `grid-cols-2` nos forms |
| `md` (768) | tabela com todas as colunas | colunas secundárias voltam |
| `lg` (1024) | sidebar 260 px + tabela | sidebar fixa, grade da Agenda, grids de 12 colunas |

## Decisões de design

### D1 — Navegação: gaveta lateral, não barra inferior

**Escolha: hambúrguer no header + gaveta que desliza da esquerda abaixo de `lg`.**

O protótipo do Lovable **não resolve isso** — ele simplesmente faz `hidden lg:flex` e
abaixo de 1024 px fica sem navegação nenhuma. Então a gaveta é trabalho novo, mas o
visual da sidebar (superfície escura `#1C1917`, grupos PRINCIPAL/GESTÃO, tile marsala
da logo) vem de lá e **não se reinventa**.

Rejeitado: **barra inferior de abas.** São 7 destinos e uma barra inferior comporta 4–5;
sobraria um "Mais" que cria uma segunda arquitetura de informação só no celular.

Rejeitado: **abas horizontais roláveis no topo.** Escondem itens fora da viewport sem
nenhuma pista de que existem.

Implementação, em ordem de preguiça:

1. Reusar o **Radix Dialog que já é dependência** do `Modal`. Dá foco preso, Esc,
   clique no backdrop e `aria-modal` de graça. Não escrever gaveta na mão, não instalar
   biblioteca nova.
2. **Não criar um componente `Drawer` genérico.** É um caso de uso, mora dentro do
   `AppShell`.
3. `Sidebar` passa a renderizar `h-full w-full`; quem posiciona é o chamador:
   - desktop: `<div className="sticky top-0 hidden h-screen w-[260px] shrink-0 lg:block">`
   - gaveta: `<Dialog.Content className="fixed inset-y-0 left-0 w-[260px] max-w-[85vw]">`
4. `Dialog.Content` recebe um `Dialog.Title` com `className="sr-only"`; o Radix conecta esse título por `aria-labelledby`, portanto não há `aria-label` concorrente.
5. **Fechar ao navegar.** Sem isso ela toca em "Clientes", a rota muda e a gaveta fica
   aberta por cima. Um `useEffect` no `AppShell` reagindo a `useLocation().pathname`
   resolve; não envolver cada `NavLink` em `Dialog.Close`.
6. O botão hambúrguer vai **à esquerda do header**, visível só abaixo de `lg`
   (`lg:hidden`), com `aria-label="Abrir menu"`.

### D2 — Tabelas: esconder coluna secundária, não virar card

**Escolha: `hidden md:table-cell` nas colunas secundárias, dobrando a informação
essencial dentro da célula que sobra.**

Rejeitado: **variante em card por tabela.** São 9 tabelas heterogêneas; seriam 9
componentes novos com marcação duplicada, e cada coluna nova depois precisaria ser
lembrada em dois lugares.

Rejeitado: **CSS `display:block` + `data-label`.** Truque conhecido, mas destrói a
semântica de tabela para o leitor de tela e é frágil.

Rejeitado: **deixar só o `overflow-x-auto` que já existe.** É o estado atual e é
justamente o que empurra Ações para fora da tela.

Por que a escolha ganha: é uma classe por par `<th>`/`<td>`, sem componente novo, sem
marcação duplicada, a semântica de tabela fica intacta e **a coluna Ações volta a caber
porque a tabela encolheu**. Regra geral por tabela: manter **identidade + o número que
importa + ações**; o resto entra na célula de identidade como linha secundária ou some.

Aplicar em: `AtendimentoTabela`, `TabelaTutores`, `TabelaPets`, `HistoricoTabela`,
`Pacotes`, `Servicos`, `CustosSecao`, `RetiradasSecao`.

Mapa para a `AtendimentoTabela` (a mais carregada), como referência das outras:

| Coluna | < md | Observação |
|---|---|---|
| Data | dobrar na célula Pet | data e hora viram linha de cima do nome |
| Pet / Tutor | **fica** | recebe data, status e origem como linhas secundárias |
| Serviço | esconde | |
| Origem | dobrar como badge na célula Pet | Pacote vs Avulso muda o que ela cobra, não pode sumir |
| Status | dobrar como badge na célula Pet | |
| Valor | **fica** | |
| Ações | **fica** | é o que hoje está fora da tela |

### D3 — Agenda: lista por dia abaixo de `lg`, grade acima

**Escolha: abaixo de `lg`, esconder a grade semanal e mostrar os atendimentos da semana
agrupados por dia, em lista.**

Grade de tempo com 6 colunas é uma visualização que **depende de largura** para
significar alguma coisa. Espremer não adapta, destrói. A informação que ela precisa no
celular ("o que tem hoje, o que vem depois") é sequencial, e lista é a forma certa.

Isso **não é esconder funcionalidade**: é a mesma semana, os mesmos atendimentos, os
mesmos links para editar. As setas de semana e o botão Hoje continuam.

Reusar o que já existe: a seção "Próximos atendimentos" ([Agenda.tsx:245](frontend/src/pages/Agenda.tsx#L245))
já renderiza `AtendimentoTabela`. A lista mobile é a mesma ideia sem o filtro
`a.data >= hoje`, com um cabeçalho por dia.

Alternativa considerada e rejeitada: **grade de um dia só, com setas de dia.** Mantém a
noção de horário, mas exige estado novo, muda o significado das setas conforme o
tamanho da tela e não sobrevive a rotacionar o telefone no meio do uso.

**Manter o aviso de corte** ([Agenda.tsx:135](frontend/src/pages/Agenda.tsx#L135)): a
busca não pagina e o excedente não é desenhado. Isso vale igual na lista.

### D4 — Modal: altura máxima e o efeito colateral que ela cria

Corrigir B2 com `max-h-[85dvh] overflow-y-auto` no `Dialog.Content` (`dvh`, não `vh`,
por causa da barra de URL) e `p-4 sm:p-6`.

**Atenção, isto é uma armadilha:** colocar `overflow-y-auto` no Modal **cria um contexto
de recorte** e o dropdown do [Combobox](frontend/src/components/ui/Combobox.tsx#L94),
que é `position: absolute`, passa a ser **cortado dentro do modal**. O `PacoteForm` usa
Combobox dentro de Modal ([PacoteForm.tsx:144](frontend/src/components/pacotes/PacoteForm.tsx#L144)),
então a busca de pet na venda de pacote quebra em silêncio.

Duas saídas, nesta ordem de preferência:

1. Deixar o scroll num wrapper interno e manter o `Dialog.Content` sem `overflow`, de
   modo que o dropdown escape.
2. Se não der, portar o dropdown do Combobox para `position: fixed` com posicionamento
   calculado, ou para o `Popover` do Radix.

**Verificar isso manualmente na venda de pacote antes de fechar a fase.** É exatamente
o tipo de quebra que passa por todos os testes.

### D5 — Toque e zoom: variantes de ponteiro, não breakpoint

Tamanho de tela não diz método de entrada. Usar as variantes nativas do Tailwind v4:

- **Alvo de toque:** `pointer-coarse:min-h-11` (44 px) no `Button`. Uma classe, um
  arquivo, todos os botões do app. Mesmo tratamento nas setas da Agenda e nos itens da
  Sidebar.
- **Zoom do iOS:** os campos precisam de **16px em ponteiro grosso**. `text-sm
  pointer-coarse:text-base` em `Input`, `Select` e `Combobox`. Sem isso, todo toque num
  campo dá zoom e não volta.
- **Hover:** as tabelas usam `hover:bg-creme/50` e links usam `hover:underline`. É
  decorativo, nada depende de hover para funcionar. Deixar como está.

### D6 — CSS puro, sem `useMediaQuery`

**Regra rígida para quem implementar:** nada de `window.innerWidth`, `matchMedia` ou
hook de breakpoint para escolher o que renderizar. Só classes utilitárias e variantes.

Motivos concretos, não estéticos:

1. Ramificação em JS duplica a árvore de render e desincroniza estado entre as duas
   versões (a gaveta é a única exceção, e é estado de aberto/fechado, não de layout).
2. Media query em CSS não existe no jsdom: os testes não veem, mas **também não
   quebram**. Ramificação em JS os testes veem pela metade, com `matchMedia` mockado,
   e passa a existir um caminho testado que não corresponde ao navegador.
3. Rotacionar o telefone reflui de graça.

## Fases

Uma fase por PR, na ordem. Cada uma é entregável sozinha.

### Fase 1 — Fundação (resolve os 4 bloqueadores)

Sem isto o app não é utilizável no celular; com isto, é.

1. `AppShell.tsx`: `min-h-dvh` no lugar de `min-h-screen`; botão hambúrguer `lg:hidden`
   à esquerda do header; estado da gaveta; fechar ao mudar de rota.
2. `Sidebar.tsx`: `<aside>` vira `flex h-full w-full flex-col`, sem `sticky`/`h-screen`/
   `w-[260px]`. Quem posiciona é o `AppShell`.
3. Gaveta com Radix Dialog no `AppShell`, `Dialog.Title` sr-only e foco preso.
4. `Modal.tsx`: `max-h-[85dvh]`, scroll interno, `p-4 sm:p-6`. **Conferir o Combobox
   dentro do modal de venda de pacote.**
5. `Button.tsx`: `pointer-coarse:min-h-11`.
6. `Input.tsx`, `Select.tsx`, `Combobox.tsx`: `pointer-coarse:text-base`.

### Fase 2 — Telas de leitura

O que ela mais vai fazer do sofá.

7. `AtendimentoTabela.tsx` conforme o mapa da D2.
8. `Agenda.tsx`: grade `hidden lg:block`, lista por dia `lg:hidden`; controles de semana
   com quebra de linha.
9. `FiltrosAtendimento.tsx`: trocar os dois `w-44` por `flex-1 basis-40` ou
   `grid grid-cols-2 sm:flex`.
10. `Dashboard.tsx`: conferir em 390 px. A estrutura já é mobile-first; espera-se ajuste
    pequeno no `HeroFaturamento` (`text-4xl` pode estourar) e no `GraficoMensal`.

### Fase 3 — Listas e cadastros

11. `TabelaTutores`, `TabelaPets`, `HistoricoTabela` conforme D2.
12. `Clientes.tsx`: a linha de busca + switch de aba (`flex-wrap items-end justify-between`)
    empilha em 390 px; garantir que o switch não fique espremido.
13. Tabelas de `Pacotes`, `Servicos`, `CustosSecao`, `RetiradasSecao` conforme D2.

### Fase 4 — Formulários (caminho de escrita)

14. Os 6 `grid grid-cols-2` → `grid-cols-1 sm:grid-cols-2`.
15. `AtendimentoForm`: é o formulário mais longo do app e o mais crítico. Conferir o
    `PagamentosField` (linhas de pagamento com valor + método lado a lado) e o rodapé de
    botões.
16. `Login.tsx`: conferir; provavelmente já está bem, é um card centrado.

## Verificação

Responsividade em CSS **não é testável por unit test** — o jsdom não tem motor de CSS e
não aplica media query. Então:

**O que dá para testar (e deve):**

- A gaveta abre, fecha no Esc, fecha no backdrop e **fecha ao navegar**. É estado React,
  é testável, e o "fecha ao navegar" é o que mais quebra numa refatoração futura.
- Os testes existentes (216 hoje) precisam continuar verdes. Esconder coluna com
  `hidden md:table-cell` **não remove o nó do DOM**, então `getByText` continua achando.
  Se algum teste quebrar, é sinal de que alguém removeu conteúdo em vez de escondê-lo —
  o que é justamente o que a D2 proíbe.

**O que só a mão verifica** (obrigatório antes de cada PR fechar):

- DevTools em 390 px **e** 360 px, retrato e paisagem.
- **Um iPhone real**, porque o zoom de campo do Safari e o `dvh` não reproduzem no
  emulador.
- Venda de pacote com o Combobox dentro do modal (a armadilha da D4).
- Um formulário longo com o teclado aberto: o `AtendimentoForm` e o `PacoteForm`.

```
npx tsc --noEmit
npm run lint
npm run test
```

## Riscos

1. **O Combobox dentro do modal com scroll** (D4). É o único ponto do plano que pode
   exigir mudar um componente que hoje funciona.
2. **Escopo da D2 crescendo para 9 componentes de card.** Se em algum momento a
   implementação começar a criar `TabelaXCard.tsx`, parar: a decisão foi esconder
   coluna, não duplicar marcação.
3. **A Agenda em lista pode desagradar.** O Diogo valoriza a Agenda visual (ela saiu do
   backlog a pedido dele). Vale mostrar a lista mobile para a Patricia antes de
   considerar a Fase 2 fechada.

## Antes de implementar

O visual da gaveta não pode ser inventado: abrir `src/components/app-shell.tsx` e
`src/styles.css` do projeto Lovable (`766bc963-b60f-4abb-adbd-b5f729fdd503`) pelo MCP e
reusar a superfície escura e os grupos de navegação já definidos lá. O protótipo não tem
gaveta, mas tem a sidebar — a gaveta é a mesma sidebar em outra moldura.
