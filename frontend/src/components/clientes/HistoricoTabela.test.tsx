import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Atendimento } from "../../lib/types";
import { HistoricoTabela } from "./HistoricoTabela";

function atendimento(over: Partial<Atendimento>): Atendimento {
  return {
    id: 1, pet: 7, servico: 1, servico_nome: "Banho", pet_nome: "Luna", tutor_nome: "Ana Clara",
    pacote: null, data: "2026-07-01", horario: "10:00:00", valor: "95.00",
    transporte: false, transporte_valor: "0.00", status: "Liberado", pagamentos: [],
    ...over,
  };
}

describe("HistoricoTabela", () => {
  it("marca consumo de pacote quando pacote não é nulo", () => {
    render(
      <HistoricoTabela
        atendimentos={[
          atendimento({ id: 1, pacote: 3, servico_nome: "Banho" }),
          atendimento({ id: 2, pacote: null, servico_nome: "Banho e Tosa" }),
        ]}
      />,
    );

    expect(screen.getAllByText("Pacote")).toHaveLength(1);
    expect(screen.getAllByText("Avulso")).toHaveLength(1);
  });

  it("mostra o valor mesmo em consumo de pacote (o valor nunca é zerado)", () => {
    render(<HistoricoTabela atendimentos={[atendimento({ pacote: 3, valor: "60.00" })]} />);

    expect(screen.getByText("R$ 60,00")).toBeInTheDocument();
  });

  it("formata a data no padrão brasileiro", () => {
    render(<HistoricoTabela atendimentos={[atendimento({ data: "2026-07-01" })]} />);

    expect(screen.getByText("01/07/2026")).toBeInTheDocument();
  });
});
