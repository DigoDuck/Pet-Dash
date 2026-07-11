import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("associa o label ao input e alterna o estado", async () => {
    render(<Checkbox label="É pacote?" />);

    const campo = screen.getByLabelText("É pacote?");
    expect(campo).not.toBeChecked();

    await userEvent.click(campo);

    expect(campo).toBeChecked();
  });

  it("mostra a mensagem de erro com role alert", () => {
    render(<Checkbox label="É pacote?" error="Campo obrigatório" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Campo obrigatório");
  });
});
