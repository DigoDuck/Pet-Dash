import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Combobox } from "./Combobox";

const ITENS = [
  { id: 7, rotulo: "Luna · Ana Clara" },
  { id: 8, rotulo: "Thor · Ana Clara" },
];

describe("Combobox", () => {
  it("emite o termo digitado", async () => {
    const aoDigitarBusca = vi.fn();
    render(
      <Combobox label="Pet" itens={[]} valor={null} aoSelecionar={vi.fn()} aoDigitarBusca={aoDigitarBusca} />,
    );

    await userEvent.type(screen.getByLabelText("Pet"), "Lu");

    expect(aoDigitarBusca).toHaveBeenCalledWith("Lu");
  });

  it("seleciona um item pelo clique", async () => {
    const aoSelecionar = vi.fn();
    render(
      <Combobox label="Pet" itens={ITENS} valor={null} aoSelecionar={aoSelecionar} aoDigitarBusca={vi.fn()} />,
    );

    await userEvent.click(screen.getByLabelText("Pet"));
    await userEvent.click(screen.getByText("Luna · Ana Clara"));

    expect(aoSelecionar).toHaveBeenCalledWith({ id: 7, rotulo: "Luna · Ana Clara" });
  });

  it("seleciona com teclado (seta + enter)", async () => {
    const aoSelecionar = vi.fn();
    render(
      <Combobox label="Pet" itens={ITENS} valor={null} aoSelecionar={aoSelecionar} aoDigitarBusca={vi.fn()} />,
    );

    const input = screen.getByLabelText("Pet");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(aoSelecionar).toHaveBeenCalledWith({ id: 8, rotulo: "Thor · Ana Clara" });
  });

  it("mostra o rótulo do valor selecionado", () => {
    render(
      <Combobox
        label="Pet"
        itens={[]}
        valor={{ id: 7, rotulo: "Luna · Ana Clara" }}
        aoSelecionar={vi.fn()}
        aoDigitarBusca={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Pet")).toHaveValue("Luna · Ana Clara");
  });
});
