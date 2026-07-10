import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("usa a variante neutro por padrão", () => {
    render(<Badge>Avulso</Badge>);
    expect(screen.getByText("Avulso")).toHaveClass("text-neutro");
  });

  it("variante vip usa o acento ouro", () => {
    render(<Badge variant="vip">VIP</Badge>);
    expect(screen.getByText("VIP")).toHaveClass("text-ouro-muted");
  });

  it("variante sucesso usa o verde da marca", () => {
    render(<Badge variant="sucesso">Liberado</Badge>);
    expect(screen.getByText("Liberado")).toHaveClass("text-sucesso");
  });
});
