import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CustoForm } from "./CustoForm";

const CUSTO = {
  id: 1,
  tipo: "variavel" as const,
  descricao: "Shampoo",
  valor: "180.00",
  categoria: "Insumos",
  competencia: "2026-06-01",
};

function renderizar(props: Partial<Parameters<typeof CustoForm>[0]> = {}) {
  const aoSalvar = vi.fn();
  render(
    <CustoForm
      mesPadrao="2026-07"
      aoSalvar={aoSalvar}
      enviando={false}
      aoCancelar={vi.fn()}
      {...props}
    />,
  );
  return { aoSalvar };
}

describe("CustoForm", () => {
  it("envia a competência como dia 1 do mês", async () => {
    const { aoSalvar } = renderizar();

    await userEvent.type(screen.getByLabelText("Descrição"), "Aluguel");
    await userEvent.type(screen.getByLabelText("Valor"), "1200.00");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(aoSalvar).toHaveBeenCalledWith({
      descricao: "Aluguel",
      tipo: "fixo",
      valor: "1200.00",
      categoria: "",
      competencia: "2026-07-01",
    });
  });

  it("recusa valor zero sem chamar a API", async () => {
    const { aoSalvar } = renderizar();

    await userEvent.type(screen.getByLabelText("Descrição"), "Aluguel");
    await userEvent.type(screen.getByLabelText("Valor"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("O valor precisa ser maior que zero")).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it("recusa descrição vazia sem chamar a API", async () => {
    const { aoSalvar } = renderizar();

    await userEvent.type(screen.getByLabelText("Valor"), "1200.00");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Informe a descrição")).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it("na edição, carrega os valores salvos e a competência do próprio custo", async () => {
    renderizar({ inicial: CUSTO });

    // A competência é a do custo (junho), não a do mês aberto na página (julho):
    // editar o custo de junho não pode reescrevê-lo para outro mês.
    expect(screen.getByLabelText("Competência")).toHaveValue("2026-06");
    expect(screen.getByLabelText("Descrição")).toHaveValue("Shampoo");
    expect(screen.getByLabelText("Valor")).toHaveValue("180.00");
    expect(screen.getByLabelText("Tipo")).toHaveValue("variavel");
    expect(screen.getByLabelText("Categoria")).toHaveValue("Insumos");
  });

  it("exibe a mensagem de erro vinda da API", () => {
    renderizar({ erro: "Não foi possível salvar. Tente de novo." });

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível salvar. Tente de novo.");
  });
});
