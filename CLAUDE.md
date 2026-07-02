# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Fonte de verdade da modelagem: `PetDash - Spec.md` no vault (`02 - Projetos/Ativos/`), acessível via MCP obsidian. O brief de negócio/infra é `PetDash.md`. Este arquivo resume o que uma instância do Claude precisa saber para não violar as invariantes do domínio; a spec manda em caso de conflito.

## Estado do repositório

Greenfield. O repo ainda não tem código, é dirigido pela spec. O sistema nasce vazio (sem migração de dados legados). Ao scaffoldar, seguir a stack e a ordem de modelagem abaixo.

## O produto

App web full-stack de gestão operacional e financeira do spa/estética animal **Ângelo Spa Animal**. Usuária única: **Patricia** (dona), substituindo o controle por planilha (~130 atendimentos/mês). Consequências de projeto:

- **Single-user.** Autenticação simples, sem RBAC nem multiusuário. Não construir permissões/papéis.
- **Sem migração** no MVP.
- **100% web em produção** (a máquina da Patricia é fraca). Nada de processo pesado no cliente dela.

## Stack e deploy

- Backend: **Django + Django REST Framework**.
- Frontend: **React (Vite) + Tailwind**.
- Banco: **PostgreSQL**.
- Produção: backend + Postgres no **Railway**, frontend no **Vercel**. Dev local na máquina do Diogo.

### Comandos (quando scaffoldado)

Backend Django (dentro da pasta do backend, venv ativo):

```bash
python manage.py migrate            # aplica migrations
python manage.py makemigrations     # gera migrations a partir dos models
python manage.py runserver          # sobe a API local
pytest                              # roda a suíte (pytest-django)
pytest caminho/test_x.py::test_y    # roda um único teste
```

Frontend Vite:

```bash
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção
npm run test     # testes de componente (Vitest + RTL)
```

## Lovable = só protótipo visual (regra permanente)

Telas geradas no Lovable são **referência visual estática**, nunca backend. Ao prompar no Lovable, sempre exigir "sem backend, sem Supabase, dados mockados em array local". Antes de portar qualquer componente Lovable para o repo, rodar `grep -r "supabase"` no export e remover todo resquício antes de ligar na API DRF.

## Arquitetura do domínio

Modelo de dados (ver ERD completo na spec). Entidades: `Tutor` 1-N `Pet`; `Pet` 1-N `Atendimento` e 1-N `PacoteContratado`; `Servico` referencia `Atendimento` e define `PacoteContratado`; `PacoteContratado` 1-N `Atendimento` (consumo); `Atendimento` 1-N `Pagamento`. Mais `Custo` e `Retirada` independentes.

Ordem de implementação dos models: `Tutor`, `Pet`, `Servico` (sem dependência) → `PacoteContratado`, `Atendimento` (par crítico) → `Pagamento`, `Custo`, `Retirada`.

### Invariantes de negócio (não são óbvias no código, quebrar aqui corrompe faturamento)

Estas são o núcleo do projeto. Encapsular a regra de faturamento num manager/método do model, nunca espalhar por views.

1. **Faturamento em regime de caixa.** Faturamento de um período = soma de `PacoteContratado.valor_pago` com `data_compra` no período + soma de `Atendimento.valor` dos **avulsos** (`pacote_id IS NULL`) com status `Liberado` no período. Atendimento de consumo de pacote **não** soma (já foi pago na venda). Esquecer o filtro `pacote_id IS NULL` conta o dinheiro do pacote duas vezes.

2. **O que exclui um atendimento do faturamento é o `pacote_id` preenchido, não valor zero.** O 2º/3º/4º banho do pacote são atendimentos normais (contam em frequência, histórico, VIP), com `pacote_id` apontando ao pacote. `Atendimento.valor` guarda o preço de referência e **nunca é zerado** (zerar corrompe ticket médio e conciliação). O vínculo com o pacote é o que os tira do faturamento.

3. **Pacote Fidelidade = cota mensal, não saldo perpétuo.** Um `PacoteContratado` por pet **por mês** (`competencia`), 4 créditos, cobrança recorrente paga no 1º banho do mês. O não usado não acumula. Constraint de banco: `UNIQUE(pet_id, competencia)`.

4. **Saldo do pacote é derivado, nunca armazenado.** Não existe `qtd_usada`. Saldo = `qtd_total - COUNT(atendimentos do pacote WHERE status != 'Cancelado')`. Status do `Atendimento` tem 3 valores: **Liberado** (consome), **Pendente** (ocupa o crédito, segura a vaga), **Cancelado** (devolve o crédito ao saldo mantendo o histórico). As três regras são interdependentes; testar o ciclo Pendente → Liberado → Cancelado.

5. **Reagendamento** é tratado por `validade` editável do pacote, não por engine de regras.

6. **VIP é calculado, não armazenado.** Critério por pet: 3+ visitas OU +R$500 gastos, via annotation. Ponto cego aceito: tutor com vários pets abaixo do limite nunca vira VIP. Mitigação: o dashboard também mostra "top tutores por gasto total" (query paralela).

7. **Pricing snapshotado.** `Atendimento.valor` é o preço cobrado no dia. `Servico.preco_padrao` é só sugestão de preenchimento. Faturamento histórico **jamais** faz JOIN com o catálogo.

8. **Pagamento é tabela dedicada (1-N), não enum.** Pagamento misto (Pix R$80 + Dinheiro R$40) = N linhas de `Pagamento`. Conciliação por método sai de `GROUP BY metodo`.

9. **Financeiro é derivado, nunca materializado.** Faturamento, ticket médio, lucro, margem, saldo são agregações em query. Nada persistido (evita drift).

10. **Custos e retiradas por competência mensal.** Cada custo/retirada é uma linha por mês. Custo tem `tipo` (fixo/variavel); distinção no dashboard sai de `WHERE tipo=`. Editar o aluguel de junho não reescreve maio.

11. **Soft-delete em `Tutor` e `Pet`** (`ativo`), nunca hard-delete. FKs de Tutor/Pet/Servico usam `PROTECT` para não evaporar histórico financeiro.

### Regras que o schema NÃO garante (validar na aplicação, com teste unitário desde o 1º commit)

- `sum(Pagamento.valor) == Atendimento.valor` para avulsos, validar no serializer.
- Filtro `pacote_id IS NULL` no somatório de avulsos do faturamento.
- `UNIQUE(pet_id, competencia)` no `PacoteContratado`.
- Todo atendimento de pet com pacote ativo no mês precisa gravar `pacote_id`; se esquecer, vira avulso e fatura em dobro. Forçar/sugerir na UI.
- Saldo do pacote = `qtd_total - COUNT(... WHERE status != 'Cancelado')`.

## Risco conhecido, fora do MVP

Dependência de internet: se cair durante um atendimento, o sistema fica inacessível. Mitigação mínima é fallback de dados móveis no estabelecimento. PWA/offline-first é solução real mas fora de escopo, revisitar só se virar problema recorrente.
