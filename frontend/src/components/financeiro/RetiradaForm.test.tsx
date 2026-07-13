import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RetiradaForm } from "./RetiradaForm";

function renderizar(props: Partial<Parameters<typeof RetiradaForm>[0]> = {}) {
  const aoSalvar = vi.fn();
  render(
    <RetiradaForm
      mesPadrao="2026-07"
      aoSalvar={aoSalvar}
      enviando={false}
      aoCancelar={vi.fn()}
      {...props}
    />,
  );
  return { aoSalvar };
}

// Só o relógio é falsificado; o setTimeout continua real, senão o userEvent trava.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 6, 13)); // 13/07/2026
});

afterEach(() => vi.useRealTimers());

describe("RetiradaForm", () => {
  it("no mês corrente, a data já vem preenchida com hoje", async () => {
    const { aoSalvar } = renderizar();

    expect(screen.getByLabelText("Data")).toHaveValue("2026-07-13");

    await userEvent.type(screen.getByLabelText("Descrição"), "Pró-labore");
    await userEvent.type(screen.getByLabelText("Valor"), "2000.00");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(aoSalvar).toHaveBeenCalledWith({
      descricao: "Pró-labore",
      valor: "2000.00",
      data: "2026-07-13",
      tipo: "",
    });
  });

  // Sem isto, uma retirada lançada num mês passado nasceria com a data de hoje,
  // cairia fora do intervalo que a lista filtra e sumiria da tela.
  it("num mês passado, a data cai no dia 1 daquele mês, não em hoje", () => {
    renderizar({ mesPadrao: "2026-05" });

    expect(screen.getByLabelText("Data")).toHaveValue("2026-05-01");
  });

  it("recusa valor zero sem chamar a API", async () => {
    const { aoSalvar } = renderizar();

    await userEvent.type(screen.getByLabelText("Descrição"), "Pró-labore");
    await userEvent.type(screen.getByLabelText("Valor"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("O valor precisa ser maior que zero")).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it("na edição, carrega os valores salvos", () => {
    renderizar({
      inicial: { id: 9, descricao: "Retirada extra", valor: "300.00", data: "2026-07-05", tipo: "extra" },
    });

    expect(screen.getByLabelText("Descrição")).toHaveValue("Retirada extra");
    expect(screen.getByLabelText("Valor")).toHaveValue("300.00");
    expect(screen.getByLabelText("Data")).toHaveValue("2026-07-05");
    expect(screen.getByLabelText("Tipo")).toHaveValue("extra");
  });
});
