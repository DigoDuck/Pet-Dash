import { describe, expect, it } from "vitest";
import { formatarPreco } from "./formato";

describe("formatarPreco", () => {
  it("formata o decimal em string que vem da API", () => {
    expect(formatarPreco("1200.00")).toBe("R$ 1200,00");
    expect(formatarPreco("60.5")).toBe("R$ 60,50");
  });

  it("formata number, usado nas somas locais", () => {
    expect(formatarPreco(80)).toBe("R$ 80,00");
  });
});
