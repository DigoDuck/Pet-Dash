import { describe, expect, it } from "vitest";
import { formatarPercentual, formatarPreco, formatarPrecoCurto } from "./formato";

describe("formatarPreco", () => {
  it("formata o decimal em string que vem da API", () => {
    expect(formatarPreco("1200.00")).toBe("R$ 1200,00");
    expect(formatarPreco("60.5")).toBe("R$ 60,50");
  });

  it("formata number, usado nas somas locais", () => {
    expect(formatarPreco(80)).toBe("R$ 80,00");
  });
});

describe("formatarPrecoCurto", () => {
  it("abrevia milhares para caber no rótulo da barra", () => {
    expect(formatarPrecoCurto("23194.00")).toBe("R$ 23,2k");
    expect(formatarPrecoCurto("1000.00")).toBe("R$ 1,0k");
  });

  it("mantém valores abaixo de mil sem abreviar", () => {
    expect(formatarPrecoCurto("950.40")).toBe("R$ 950");
    expect(formatarPrecoCurto("0.00")).toBe("R$ 0");
  });
});

describe("formatarPercentual", () => {
  it("converte a fração da API em percentual", () => {
    expect(formatarPercentual("0.6490")).toBe("64,9%");
    expect(formatarPercentual("1.0000")).toBe("100,0%");
    expect(formatarPercentual("0")).toBe("0,0%");
  });

  it("aceita margem negativa (mês no prejuízo)", () => {
    expect(formatarPercentual("-0.2500")).toBe("-25,0%");
  });
});
