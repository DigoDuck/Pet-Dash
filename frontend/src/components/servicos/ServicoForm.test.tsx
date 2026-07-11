import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ServicoForm } from "./ServicoForm";

describe("ServicoForm", () => {
  it("esconde créditos até marcar 'é pacote'", async () => {
    render(<ServicoForm aoSalvar={vi.fn()} enviando={false} aoCancelar={() => {}} />);

    expect(screen.queryByLabelText("Créditos")).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("É pacote?"));

    expect(screen.getByLabelText("Créditos")).toBeInTheDocument();
  });

  it("envia serviço avulso com creditos null", async () => {
    const aoSalvar = vi.fn();
    render(<ServicoForm aoSalvar={aoSalvar} enviando={false} aoCancelar={() => {}} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Banho");
    await userEvent.type(screen.getByLabelText("Preço"), "60.00");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(aoSalvar).toHaveBeenCalledWith({
      nome: "Banho",
      preco_padrao: "60.00",
      is_pacote: false,
      creditos: null,
    });
  });

  it("exige créditos quando é pacote", async () => {
    const aoSalvar = vi.fn();
    render(<ServicoForm aoSalvar={aoSalvar} enviando={false} aoCancelar={() => {}} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Pacote Fidelidade");
    await userEvent.type(screen.getByLabelText("Preço"), "220.00");
    await userEvent.click(screen.getByLabelText("É pacote?"));
    await userEvent.clear(screen.getByLabelText("Créditos"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Pacote precisa de ao menos 1 crédito")).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it("envia pacote com creditos numérico", async () => {
    const aoSalvar = vi.fn();
    render(<ServicoForm aoSalvar={aoSalvar} enviando={false} aoCancelar={() => {}} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Pacote Fidelidade");
    await userEvent.type(screen.getByLabelText("Preço"), "220.00");
    await userEvent.click(screen.getByLabelText("É pacote?"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(aoSalvar).toHaveBeenCalledWith({
      nome: "Pacote Fidelidade",
      preco_padrao: "220.00",
      is_pacote: true,
      creditos: 4,
    });
  });
});
