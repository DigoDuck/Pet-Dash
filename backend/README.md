# Backend (Django + DRF)

Projeto Django ainda a scaffoldar. Ordem de modelagem dos models (ver `CLAUDE.md` e a spec):

`Tutor`, `Pet`, `Servico` (sem dependência) → `PacoteContratado`, `Atendimento` (par crítico) → `Pagamento`, `Custo`, `Retirada`.

As 5 regras que o schema não garante entram com teste unitário desde o 1º commit.
