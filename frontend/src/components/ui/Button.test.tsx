import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("usa a variante primary (marsala) por padrão", () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveClass("bg-marsala");
  });

  it("aplica a variante secondary (contorno marsala)", () => {
    render(<Button variant="secondary">Cancelar</Button>);
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveClass("border-marsala");
  });

  it("aplica a variante danger (erro)", () => {
    render(<Button variant="danger">Excluir</Button>);
    expect(screen.getByRole("button", { name: "Excluir" })).toHaveClass("bg-erro");
  });

  it("aplica a variante dangerGhost (texto erro, sem fundo sólido)", () => {
    render(<Button variant="dangerGhost">Excluir</Button>);
    const botao = screen.getByRole("button", { name: "Excluir" });
    expect(botao).toHaveClass("text-erro");
    expect(botao).not.toHaveClass("bg-erro");
  });

  it("repassa disabled para o elemento nativo", () => {
    render(<Button disabled>Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });
});
