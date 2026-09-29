import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("usa a variante neutro por padrão", () => {
    render(<Badge>Avulso</Badge>);
    // Texto escuro sobre o cinza: `text-neutro` ali dava 4,0:1, abaixo do AA.
    expect(screen.getByText("Avulso")).toHaveClass("text-escuro-suave");
  });

  it("variante vip mantém o ouro no fundo e o texto em marsala profundo", () => {
    render(<Badge variant="vip">VIP</Badge>);
    // Dourado como texto de 12px dava 2,8:1; marsala profundo sobre o ouro dá 11:1.
    expect(screen.getByText("VIP")).toHaveClass("bg-ouro/15", "text-marsala-dark");
  });

  it("variante sucesso usa o verde da marca", () => {
    render(<Badge variant="sucesso">Liberado</Badge>);
    expect(screen.getByText("Liberado")).toHaveClass("text-sucesso");
  });
});
