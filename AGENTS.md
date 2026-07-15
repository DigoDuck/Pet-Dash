# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

> Fonte de verdade da modelagem e do escopo: `PetDash - Spec.md` no vault (`02 - Projetos/Ativos/`, via MCP obsidian) e o design doc + Tasks no repo. O brief de negócio/infra é `PetDash.md`. Este arquivo resume o que uma instância do Codex precisa saber para não violar as invariantes do domínio; a spec/design doc mandam em caso de conflito. **Não reabra decisões fechadas sem me perguntar.**

## Contexto

Greenfield. O repo nasce vazio, dirigido pela spec (sem migração de dados legados). App web full-stack de gestão operacional e financeira do spa/estética animal **Ângelo Spa Animal**, substituindo o controle por planilha (~130 atendimentos/mês). Usuária única: **Patricia** (dona).

Priorize entregar o MVP **funcional e correto**. Nada de over-engineering: escopo mínimo, bem-feito. Consequências de projeto:

- **Single-user.** Autenticação simples, sem RBAC nem multiusuário. Não construir permissões/papéis.
- **Sem migração** no MVP.
- **100% web em produção** (a máquina da Patricia é fraca). Nada de processo pesado no cliente dela.

## Fluxo de trabalho (obrigatório)

1. Antes de codar qualquer coisa não-trivial: **plan mode**. Apresente o plano e **espere meu ok**. Só implemente depois.
2. **Um PR por vez**, seguindo o arquivo de Tasks (branches nomeadas como lá). Não pule adiante nem misture PRs.
3. **Verificação é obrigatória.** Nunca diga "funciona" sem mostrar evidência: o comando rodado e a saída do `pytest`. Sem teste passando, o PR não está pronto.
4. Rode `ruff` e a suíte de testes antes de considerar qualquer PR concluído.
5. Commits pequenos e descritivos, em português.
6. **Ao concluir cada PR, gerar um relatório didático** em `estudos/` (pasta não versionada). Formato: nome do PR, tarefas feitas e **justificativa de cada escolha** (por que fiz assim e segui por esse caminho). Público-alvo: eu, dev júnior, para entender o código a fundo e explicar numa entrevista — linguagem clara, com os conceitos por trás, não só o "o quê". Um arquivo por PR: `estudos/PR-XX-<slug>.md`.

## Contrato de aprendizado

> Se este projeto passar para **Modo Velocidade**, remova esta seção ou troque por: "Pode implementar tudo; eu reviso o diff."

- **A lógica de Pacote Fidelidade (crédito, saldo, faturamento) é MINHA de escrever.** Nos models de operação e no manager/serviço de faturamento e saldo: **não implemente**. Proponha o plano, aponte alternativas e trade-offs, e **revise a MINHA implementação** como um sênior faria — encontre bugs e casos não cobertos, mas não escreva o código por mim.
- **Todo o resto** (scaffold, auth, CRUD, ViewSets simples, frontend): **pode implementar direto**; eu reviso o diff. (Otimização: aprendo fundo a peça mais difícil, entrego rápido o resto.)

## Stack e deploy

- Backend: **Django + Django REST Framework**. Auth: `simplejwt`.
- Frontend: **React (Vite) + Tailwind**.
- Banco: **PostgreSQL**.
- Dev: **Docker**. Testes: `pytest-django` + `factory_boy`. Lint/format: `ruff`.
- Produção: backend + Postgres no **Railway**, frontend no **Vercel**. Dev local na máquina do Diogo.

### Comandos (quando scaffoldado)

Backend Django (dentro da pasta do backend, venv ativo):

```bash
python manage.py migrate            # aplica migrations
python manage.py makemigrations     # gera migrations a partir dos models
python manage.py runserver          # sobe a API local
pytest                              # roda a suíte (pytest-django)
pytest caminho/test_x.py::test_y    # roda um único teste
ruff check .                        # lint
```

Frontend Vite:

```bash
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção
npm run test     # testes de componente (Vitest + RTL)
```

## Arquitetura do domínio

Modelo de dados (ver ERD completo na spec). Entidades: `Tutor` 1-N `Pet`; `Pet` 1-N `Atendimento` e 1-N `PacoteContratado`; `Servico` referencia `Atendimento` e define `PacoteContratado`; `PacoteContratado` 1-N `Atendimento` (consumo); `Atendimento` 1-N `Pagamento`. Mais `Custo` e `Retirada` independentes.

Ordem de implementação dos models: `Tutor`, `Pet`, `Servico` (sem dependência) → `PacoteContratado`, `Atendimento` (par crítico) → `Pagamento`, `Custo`, `Retirada`.

### Invariantes de negócio (não são óbvias no código, quebrar aqui corrompe faturamento)

Estas decisões estão **fechadas** e são o núcleo do projeto. Se algo no código as contrariar, **PARE e me avise**. Encapsular a regra de faturamento num manager/método do model, nunca espalhar por views.

1. **Faturamento em regime de caixa.** Faturamento de um período = soma de `PacoteContratado.valor_pago` com `data_compra` no período + soma de `Atendimento.valor` dos **avulsos** (`pacote_id IS NULL`) com status `Liberado` no período + soma de `Atendimento.transporte_valor` de **todos** os `Liberado` no período (inclusive consumo de pacote). O `valor` do consumo de pacote **não** soma (já foi pago na venda); o `transporte_valor` dele soma, porque a corrida é cobrada por viagem e não sai da cota. Esquecer o filtro `pacote_id IS NULL` no `valor` conta o dinheiro do pacote duas vezes; restringir o `transporte_valor` a avulsos perde a corrida de toda cliente com pacote.

   > O transporte entrou no faturamento em 14/07/2026 (PR `fix/transporte-faturamento`). Antes disso o sistema contabilizava o **custo** do triciclo (manutenção fixa + combustível) e ignorava a **receita** da corrida, subestimando o lucro; e `transporte_valor` era dado morto — gravado, nunca cobrado, nunca conciliado. A planilha da Patricia sempre contou o transporte na receita ("Faturamento Bruto = serviços + receita do transporte"), e o total bate com a soma dos `Liberado`.

2. **O que exclui um atendimento do faturamento é o `pacote_id` preenchido, não valor zero.** O 2º/3º/4º banho do pacote são atendimentos normais (contam em frequência, histórico, VIP), com `pacote_id` apontando ao pacote. `Atendimento.valor` guarda o preço de referência e **nunca é zerado** (zerar corrompe ticket médio e conciliação). O vínculo com o pacote é o que os tira do faturamento.

3. **Pacote Fidelidade = cota mensal, não saldo perpétuo.** Um `PacoteContratado` por pet **por mês** (`competencia`), 4 créditos, cobrança recorrente paga no 1º banho do mês. O não usado não acumula. Constraint de banco: `UNIQUE(pet_id, competencia)`.

4. **Saldo do pacote é derivado, nunca armazenado.** Não existe `qtd_usada`. Saldo = `qtd_total - COUNT(atendimentos do pacote WHERE status != 'Cancelado')`. Status do `Atendimento` tem 3 valores: **Liberado** (consome), **Pendente** (ocupa o crédito, segura a vaga), **Cancelado** (devolve o crédito ao saldo mantendo o histórico). As três regras são interdependentes; testar o ciclo Pendente → Liberado → Cancelado.

5. **Reagendamento** é tratado por `validade` editável do pacote, não por engine de regras.

6. **VIP é calculado, não armazenado.** Critério por pet: 3+ visitas OU +R$500 gastos, via annotation. Ponto cego aceito: tutor com vários pets abaixo do limite nunca vira VIP. Mitigação: o dashboard também mostra "top tutores por gasto total" (query paralela).

7. **Pricing snapshotado.** `Atendimento.valor` é o preço cobrado no dia. Os preços do `Servico` são só sugestão de preenchimento. Faturamento histórico **jamais** faz JOIN com o catálogo.

   **Preço por faixa de peso** (tabela da Patricia, jul/2026). Ela precifica por peso, não por porte subjetivo: `preco_padrao` = pequeno (até 10 kg) · `preco_m` = médio (10 a 15 kg) · `preco_g` = grande (acima de 15 kg). Faixa sem preço próprio **cai no preço do pequeno** — sugestão baixa ela corrige na tela; campo vazio a faria digitar do zero em todo atendimento. A tabela original dela pula de "até 10kg" para "12 a 15kg", e a faixa média foi fechada em 10–15kg para não existir pet sem preço (**confirmar com ela**). Acima de 15 kg só o banho tem preço (a partir de R$ 150); nos demais serviços `preco_g` fica vazio de propósito, porque inventar número num campo de preço é pior do que sugerir baixo.

   Regras dela que **não** viram item de catálogo:
   - **+40% para pet agressivo / contenção especial.** É multiplicador, não serviço. Virou o checkbox `Atendimento.manejo_especial`, que só ajusta a **sugestão** de preço no formulário — o backend nunca recalcula `valor`.
   - **+R$ 25 do banho medicinal obrigatório** quando se identifica parasita. Acréscimo fixo aplicado na hora; a Patricia digita o valor. Não modelado (dois mecanismos de acréscimo para duas regras seria over-engineering).
   - **Juros da maquininha no cartão.** Muda o que ela *recebe*, não o que cobra. Fora do MVP; nem a planilha faz.

8. **Pagamento é tabela dedicada (1-N), não enum.** `forma_pagamento` **não** existe como enum no Atendimento. Pagamento simples = 1 linha; misto (Pix R$80 + Dinheiro R$40) = N linhas de `Pagamento`. Conciliação por método sai de `GROUP BY metodo`.

9. **Financeiro é derivado, nunca materializado.** Faturamento, ticket médio, lucro, margem, saldo são agregações em query. Nada persistido (evita drift).

10. **Custos e retiradas por competência mensal.** Cada custo/retirada é uma linha por mês. Custo tem `tipo` (fixo/variavel); distinção no dashboard sai de `WHERE tipo=`. Editar o aluguel de junho não reescreve maio.

11. **Soft-delete em `Tutor` e `Pet`** (`ativo`), nunca hard-delete. FKs de Tutor/Pet/Servico usam `PROTECT` para não evaporar histórico financeiro.

### Regras que o schema NÃO garante (validar na aplicação, com teste unitário desde o 1º commit)

- `sum(Pagamento.valor) == valor cobrado`, validar no serializer. O valor cobrado é `valor + transporte_valor` no avulso e **só** `transporte_valor` no consumo de pacote (o serviço já foi pago na venda). Uma regra só para os dois ramos: enquanto o ramo do pacote pulava a validação, o dinheiro da corrida escapava sem nenhuma linha de `Pagamento`.
- Filtro `pacote_id IS NULL` no somatório de avulsos do faturamento.
- `UNIQUE(pet_id, competencia)` no `PacoteContratado`.
- Todo atendimento de pet com pacote ativo no mês precisa gravar `pacote_id`; se esquecer, vira avulso e fatura em dobro. Forçar/sugerir na UI.
- Saldo do pacote = `qtd_total - COUNT(... WHERE status != 'Cancelado')`.

## Testes

- Toda invariante acima merece teste. Priorize: exclusão de pacote do faturamento · saldo derivado · ocupação/estorno de crédito por status · soft-delete não some do histórico.
- Use `factory_boy` para dados de teste.
- **Oráculo de verificação financeira:** os números do dashboard (faturamento / margem / ticket médio) têm gabarito na planilha real `controle_financeiro_pet.xlsx`. Quando eu pedir, compare o computado com a planilha.

## Ferramentas de IA fora do versionamento

Pastas de tooling de IA (skills/plugins/caches do Codex) **não sobem para o repo**. Já ignoradas no `.gitignore`: `.Codex/` e `.impeccable/`. Ao adicionar outra ferramenta que crie pasta local no projeto, ignorá-la também.

## Lovable = só protótipo visual (regra permanente)

Telas geradas no Lovable são **referência visual estática**, nunca backend. Ao prompar no Lovable, sempre exigir "sem backend, sem Supabase, dados mockados em array local". Antes de portar qualquer componente Lovable para o repo, rodar `grep -r "supabase"` no export e **remover todo resquício** — os dados vêm da API DRF, nunca de Supabase. Tailwind com os tokens da marca (brand-book).

## O que NÃO fazer

- Nada de over-engineering nem features fora do MVP. O backlog (agenda visual, meta mensal, conciliação "fechar o mês", saldo bancário, busca global, notificações, PWA/offline) está **fora**. Se achar que algo do backlog é necessário, **pergunte**.
- Não materializar valores financeiros. Não criar `qtd_usada`. Não usar enum de forma de pagamento. (Erros clássicos que contrariam a Spec.)
- Não reabrir decisões de modelagem fechadas sem me consultar.

## Regras rígidas → hooks

O que PRECISA acontecer sempre não deve viver só neste texto (instrução em markdown é seguida ~70% das vezes). Configure (ou me lembre de configurar) **hooks**: `ruff` no write · rodar `pytest` após edições em models/serviços · bloquear commit com teste quebrado. Hook é garantido; texto é sugestão.

## Risco conhecido, fora do MVP

Dependência de internet: se cair durante um atendimento, o sistema fica inacessível. Mitigação mínima é fallback de dados móveis no estabelecimento. PWA/offline-first é solução real mas fora de escopo, revisitar só se virar problema recorrente.
