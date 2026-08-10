import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Confirmacao } from "./Confirmacao";

function montar(over: Partial<Parameters<typeof Confirmacao>[0]> = {}) {
  const props = {
    aberto: true,
    titulo: "Excluir custo",
    mensagem: "Excluir Aluguel? A exclusão é permanente.",
    rotuloConfirmar: "Excluir",
    aoConfirmar: vi.fn(),
    aoCancelar: vi.fn(),
    ...over,
  };
  render(<Confirmacao {...props} />);
  return props;
}

describe("Confirmacao", () => {
  it("mostra título e mensagem e confirma pelo botão da ação", async () => {
    const { aoConfirmar, aoCancelar } = montar();

    expect(screen.getByText("Excluir Aluguel? A exclusão é permanente.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    expect(aoConfirmar).toHaveBeenCalledOnce();
    expect(aoCancelar).not.toHaveBeenCalled();
  });

  it("desiste pelo Voltar sem executar a ação", async () => {
    const { aoConfirmar, aoCancelar } = montar();

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(aoCancelar).toHaveBeenCalledOnce();
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  // Sem o disabled, o duplo clique na exclusão dispara dois DELETE.
  it("trava o botão da ação enquanto a requisição corre", () => {
    montar({ enviando: true });

    expect(screen.getByRole("button", { name: "Aguarde..." })).toBeDisabled();
  });

  it("não renderiza nada fechado", () => {
    montar({ aberto: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // A recusa do backend precisa aparecer onde ela clicou, e com role="alert" para o
  // leitor de tela anunciar sem que ela precise procurar.
  it("mostra a recusa da ação dentro do diálogo", () => {
    montar({ erro: "Este pacote já tem atendimento vinculado." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Este pacote já tem atendimento vinculado.",
    );
  });

  it("sem erro não sobra alerta na tela", () => {
    montar();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
