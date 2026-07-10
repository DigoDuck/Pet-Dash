import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Select } from "./Select";

describe("Select", () => {
  it("associa o label ao select e permite escolher uma opção", async () => {
    render(
      <Select label="Porte" defaultValue="">
        <option value="">Não informado</option>
        <option value="M">Médio</option>
      </Select>,
    );

    const campo = screen.getByLabelText("Porte");
    await userEvent.selectOptions(campo, "M");

    expect(campo).toHaveValue("M");
  });

  it("mostra a mensagem de erro com role alert", () => {
    render(
      <Select label="Porte" error="Escolha um porte">
        <option value="">Não informado</option>
      </Select>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Escolha um porte");
    expect(screen.getByLabelText("Porte")).toHaveAttribute("aria-invalid", "true");
  });
});
