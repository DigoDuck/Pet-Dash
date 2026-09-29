import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TutorForm } from "./TutorForm";

describe("TutorForm", () => {
  it("exige nome e telefone", async () => {
    const aoSalvar = vi.fn();
    render(<TutorForm aoSalvar={aoSalvar} enviando={false} aoCancelar={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Informe o nome")).toBeInTheDocument();
    expect(screen.getByText("Informe o telefone")).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it("mostra o erro do backend em vez de falhar calado", () => {
    render(
      <TutorForm
        aoSalvar={vi.fn()}
        enviando={false}
        erro="Telefone: Este campo é obrigatório."
        aoCancelar={() => {}}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Telefone: Este campo é obrigatório.");
  });

  it("envia os dados preenchidos", async () => {
    const aoSalvar = vi.fn();
    render(<TutorForm aoSalvar={aoSalvar} enviando={false} aoCancelar={() => {}} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Ana Clara");
    await userEvent.type(screen.getByLabelText("Telefone"), "71988880001");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(aoSalvar).toHaveBeenCalledWith({
      nome: "Ana Clara",
      telefone: "71988880001",
      email: "",
    });
  });

  it("pré-preenche ao editar", () => {
    render(
      <TutorForm
        inicial={{ nome: "Rafael", telefone: "71", email: "r@x.com" }}
        aoSalvar={vi.fn()}
        enviando={false}
        aoCancelar={() => {}}
      />,
    );

    expect(screen.getByLabelText("Nome")).toHaveValue("Rafael");
  });
});
