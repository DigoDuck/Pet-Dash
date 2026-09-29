---
name: PetDash
description: Gestão operacional e financeira do Ângelo Spa Animal
colors:
  marsala: "#7b2332"
  marsala-light: "#9b3344"
  marsala-dark: "#5a1a26"
  ouro: "#c9a44c"
  ouro-light: "#e8d5a0"
  ouro-muted: "#a8884a"
  creme: "#fdf8f0"
  fundo: "#faf6f1"
  escuro: "#1c1917"
  escuro-suave: "#2e2926"
  neutro: "#78716c"
  neutro-light: "#d6d3d1"
  sucesso: "#3d7a4a"
  erro: "#b83c3c"
typography:
  display:
    fontFamily: "DM Serif Display, serif"
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: 1.2
  title:
    fontFamily: "DM Serif Display, serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  data:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  control: "8px"
  dialog: "12px"
  surface: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.marsala}"
    textColor: "{colors.creme}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.marsala-light}"
  button-secondary:
    textColor: "{colors.marsala}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-ghost:
    textColor: "{colors.escuro}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-danger:
    backgroundColor: "{colors.erro}"
    textColor: "{colors.creme}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-danger-ghost:
    textColor: "{colors.erro}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.escuro}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  table-surface:
    backgroundColor: "{colors.creme}"
    rounded: "{rounded.surface}"
  sidebar:
    backgroundColor: "{colors.escuro}"
    textColor: "{colors.creme}"
  sidebar-item-active:
    backgroundColor: "{colors.escuro-suave}"
    textColor: "{colors.ouro}"
  dialog:
    backgroundColor: "{colors.creme}"
    rounded: "{rounded.dialog}"
---

# Design System: PetDash

## 1. Overview

**Creative North Star: "O caderno do balcão"**

O PetDash é o caderno em que a Patricia anota o dia do spa, só que um caderno que faz as contas sozinho. Superfícies claras e quentes, texto escuro, a marca (marsala e dourado) aparecendo em pontos pequenos de decisão: o botão principal, o item ativo do menu, o crédito de pacote. A navegação é uma faixa escura e estável à esquerda; o conteúdo respira à direita.

A densidade é de ferramenta, não de relatório. Uma ação principal por tela, tabelas com poucas colunas e texto de apoio em cinza quente. Números sempre em JetBrains Mono, alinhados à direita, para comparar de olho. Títulos de página em DM Serif Display, a única concessão "de spa" na tipografia.

O sistema rejeita a cara de ERP (dez colunas com o mesmo peso, jargão, cinza sobre cinza) e a cara de SaaS genérico (cards de métrica com gradiente, ícone em círculo sobre cada título).

**Key Characteristics:**

- Marsala só onde há decisão; dourado só onde há valor (crédito, VIP, item ativo).
- Estados sempre em texto, nunca só em cor.
- Dinheiro em fonte monoespaçada, sem arredondar.
- Uma ação em destaque por tela; ações destrutivas repetidas ficam discretas.

## 2. Colors

Paleta restrita: neutros quentes carregam a tela, marsala marca a ação, dourado marca o valor.

### Primary

- **Marsala** (#7b2332): botão principal, links de ação, foco de campo. Nunca em superfícies grandes.
- **Marsala claro** (#9b3344): hover do botão principal.
- **Marsala profundo** (#5a1a26): reservado para contraste sobre dourado.

### Secondary

- **Dourado** (#c9a44c): item ativo do menu, marcadores de crédito de pacote, destaque VIP. Nunca como cor de texto pequeno sobre fundo claro (contraste abaixo de 3:1).
- **Dourado claro** (#e8d5a0): fundo de badge de pendência.
- **Dourado apagado** (#a8884a): texto de badge VIP apenas em tamanho grande; em texto de 12px não passa no AA.

### Neutral

- **Creme** (#fdf8f0): superfície de tabelas, cards e diálogos.
- **Fundo** (#faf6f1): fundo da página.
- **Escuro** (#1c1917): texto principal e a faixa da sidebar.
- **Escuro suave** (#2e2926): texto secundário forte, item ativo da sidebar.
- **Neutro** (#78716c): texto de apoio, rótulos de coluna, placeholder. É o limite de contraste do sistema (cerca de 4.6:1 sobre o creme): não clarear.
- **Neutro claro** (#d6d3d1): bordas e divisores.

### Semantic

- **Sucesso** (#3d7a4a): status Liberado.
- **Erro** (#b83c3c): erros, status Cancelado, ações destrutivas.

### Named Rules

**A Regra do Ponto de Decisão.** Marsala ocupa no máximo 10% de qualquer tela. Se tudo é marsala, nada é ação.

**A Regra do Texto Legível.** Texto de 12px usa escuro, escuro suave ou neutro. Dourado e cinzas mais claros que o neutro ficam para marcadores, bordas e fundos.

## 3. Typography

**Display Font:** DM Serif Display (com serif)
**Body Font:** Inter (com system-ui, sans-serif)
**Label/Mono Font:** JetBrains Mono (com monospace)

**Character:** Serifa de revista só nos títulos, para lembrar que é um spa; Inter neutra em todo o resto, para não cansar; mono nos números, para parecerem conferíveis.

### Hierarchy

- **Display** (400, 1.875rem, 1.2): título de página ("Pacotes", "Novo atendimento").
- **Title** (400, 1.25rem, 1.3): título de diálogo e de seção.
- **Body** (400, 0.875rem, 1.5): texto de tabela e de formulário. Em tela de toque, campos sobem para 1rem para o iOS não dar zoom.
- **Label** (500, 0.875rem): rótulo de campo, sempre visível acima do campo, nunca só placeholder.
- **Data** (600, 0.875rem, JetBrains Mono): valores monetários e datas em tabela.
- **Cabeçalho de coluna** (600, 10px, tracking 0.12em, maiúsculas, neutro): único uso de caixa alta espaçada, restrito a cabeçalho de tabela e grupo do menu.

### Named Rules

**A Regra do Número Conferível.** Todo valor em reais usa a fonte mono e alinha à direita na coluna.

## 4. Elevation

Plano por padrão. A profundidade vem de camadas tonais (fundo, creme, branco do campo) e de bordas de 1px em neutro claro. Sombra aparece só no que flutua sobre a página.

### Shadow Vocabulary

- **Flutuante** (`shadow-lg` do Tailwind): diálogos e menus suspensos.
- **Leve** (`shadow-sm`): cards pontuais do painel.

### Named Rules

**A Regra do Plano.** Superfície em repouso não tem sombra. Se precisa separar, use borda ou tom.

## 5. Components

### Buttons

- **Shape:** cantos suaves (8px).
- **Primary:** marsala com texto creme, 8px 16px. Hover em marsala claro.
- **Secondary:** contorno marsala, texto marsala.
- **Ghost:** texto escuro, fundo só no hover. Para ações secundárias em linha de tabela ("Editar").
- **Danger:** erro sólido com texto creme. Só dentro de confirmação.
- **Danger ghost:** texto erro sem fundo. Para "Excluir" repetido em linha de tabela.
- **Estados:** foco com contorno dourado de 2px e afastamento de 2px; desabilitado em 50% de opacidade; em tela de toque, altura mínima de 44px.

### Inputs

- **Estilo:** fundo branco, borda neutro claro, cantos de 8px, rótulo acima.
- **Foco:** borda marsala e anel marsala a 20%.
- **Erro:** borda erro e mensagem em texto erro abaixo, com `role="alert"`.

### Tables

- **Superfície:** creme, borda neutro claro a 60%, cantos de 16px, rolagem horizontal contida.
- **Cabeçalho:** 10px, maiúsculas espaçadas, neutro.
- **Linha:** divisor de 1px, hover tonal. Primeira coluna com nome em escuro e apoio (tutor) em neutro abaixo.
- **Mobile:** colunas secundárias saem com `hidden md:table-cell` e se dobram dentro da primeira célula; Ações nunca sai da tela.

### Badges

- **Shape:** pílula, 12px, peso 500.
- **Variantes:** sucesso, erro, pendente (fundo dourado claro), neutro, VIP (borda e fundo dourados). Sempre com texto; a cor só reforça.

### Navigation

- **Sidebar:** faixa escura fixa, grupos com rótulo em maiúsculas espaçadas, item com ícone e texto. Ativo em dourado sobre escuro suave. No celular, vira gaveta.

### Dialogs

- **Estilo:** creme, cantos de 12px, sombra flutuante, título em serifa, fechar no canto com alvo de 44px no toque.

## 6. Do's and Don'ts

### Do

- **Do** dizer em texto o estado de tudo que mexe em dinheiro (pacote ou avulso, pendente ou liberado).
- **Do** usar a língua do balcão: "mês", "resta 1 de 4", "já pago na venda".
- **Do** manter uma única ação primária marsala por tela.
- **Do** alinhar valores à direita em mono.
- **Do** oferecer caminho de volta em toda escolha que o sistema faz por ela.

### Don't

- **Don't** usar dourado ou neutro claro como cor de texto pequeno.
- **Don't** repetir botão vermelho sólido em cada linha de tabela.
- **Don't** criar card de métrica com gradiente, ícone em círculo ou número gigante (cara de SaaS genérico).
- **Don't** empilhar colunas de mesmo peso visual (cara de ERP).
- **Don't** usar borda lateral colorida como destaque de card ou alerta.
- **Don't** mostrar jargão de modelo de dados na tela ("competência", "vinculado", "status" sem contexto).
