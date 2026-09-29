# Product

## Register

product

## Users

Uma usuária só: **Patricia**, dona do Ângelo Spa Animal (spa e estética animal, cerca de 130 atendimentos por mês). Ela veio de uma planilha e tem pouca intimidade com sistemas: termos técnicos ("competência", "status", "vínculo") precisam ser traduzidos para a língua do balcão.

Dois contextos de uso, os dois reais:

- **Celular, no balcão.** Entre um banho e outro, com pressa e as mãos ocupadas: lança o atendimento, confere se o pet tem pacote, libera ou cancela. Cada toque a mais custa.
- **Computador fraco, sem pressa.** Confere o financeiro, cadastra custos, vende pacotes, revisa o mês. Nada pesado pode rodar na máquina dela.

O trabalho a ser feito: registrar o que aconteceu no dia sem errar o dinheiro, e saber no fim do mês se o negócio deu lucro.

## Product Purpose

Substituir a planilha de controle operacional e financeiro do spa. O sistema registra tutores, pets, atendimentos, pacotes fidelidade, pagamentos, custos e retiradas, e calcula faturamento, lucro, margem e ticket médio em regime de caixa.

Sucesso é a Patricia confiar no número sem abrir a planilha para conferir, e nunca mais cobrar duas vezes o mesmo banho por não saber se ele saiu do pacote.

## Brand Personality

**Calma, clara, confiável.**

- **Calma:** a tela nunca compete com a tarefa. Uma ação principal por tela, o resto quieto.
- **Clara:** cada estado se explica em português do dia a dia. Se o sistema decidiu algo por ela (pacote ou avulso, pendente ou liberado), a tela diz o quê e por quê.
- **Confiável:** números alinhados, em fonte monoespaçada, sem arredondar dinheiro. Nada some sem confirmação; nada muda de valor sem ela ver.

A marca (marsala, dourado, serifa nos títulos) aparece nos detalhes, não em superfícies grandes.

## Anti-references

- **ERP ou sistema contábil:** tabelas densas, jargão financeiro, cinza sobre cinza, dez colunas com o mesmo peso visual.
- **SaaS genérico:** cards de métrica gigantes com gradiente, ícone em círculo colorido em cima de cada título, cara de template de dashboard.

## Design Principles

1. **Diga de onde vem o dinheiro.** Toda tela que mexe em valor mostra a origem e o efeito no caixa (pacote ou avulso, entra ou não entra no faturamento). Decisão silenciosa é bug.
2. **Língua do balcão, não do banco de dados.** "Mês" e não "competência"; "resta 1 de 4" e não "1/4"; "já pago na venda" e não "vinculado ao pacote".
3. **Uma coisa em destaque por vez.** A ação mais frequente é a mais visível; a destrutiva e rara é a mais discreta, e a confirmação é que carrega o peso.
4. **O polegar primeiro.** Tudo que ela faz no balcão funciona com uma mão no celular: alvos de toque grandes, nada importante escondido atrás de rolagem horizontal.
5. **Leve por construção.** Nada de animação pesada, biblioteca extra ou processamento no cliente: a máquina dela é fraca.

## Accessibility & Inclusion

- **WCAG 2.2 AA** como base: contraste de 4.5:1 para texto (inclusive texto pequeno de badge e placeholder) e 3:1 para componentes.
- Alvos de toque com pelo menos 44px em telas de toque (`pointer-coarse:min-h-11`, padrão já usado no `Button`).
- Nenhuma informação só por cor: status e origem sempre têm texto.
- `prefers-reduced-motion` respeitado em toda animação.
- Sem necessidade específica conhecida da Patricia além disso.
