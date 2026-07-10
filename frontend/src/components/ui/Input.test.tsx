import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("associa o label ao input pelo name", () => {
    render(<Input label="Usuário" name="username" />);
    expect(screen.getByLabelText("Usuário")).toBeInTheDocument();
  });

  it("mostra a mensagem de erro com role alert", () => {
    render(<Input label="Usuário" name="username" error="Informe o usuário" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o usuário");
    expect(screen.getByLabelText("Usuário")).toHaveAttribute("aria-invalid", "true");
  });

  it("sem erro não renderiza alert", () => {
    render(<Input label="Usuário" name="username" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
