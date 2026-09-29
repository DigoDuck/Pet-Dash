import { describe, expect, it } from "vitest";
import { campoDinheiro, campoDinheiroOpcional, normalizarDecimal, paraNumero } from "./dinheiro";

describe("normalizarDecimal", () => {
  it.each([
    ["65,00", "65.00"],
    ["65.00", "65.00"],
    ["1.200,50", "1200.50"],
    [" 220,5 ", "220.5"],
    ["80", "80"],
  ])("%s vira %s", (entrada, saida) => {
    expect(normalizarDecimal(entrada)).toBe(saida);
  });
});

describe("paraNumero", () => {
  it("soma com vírgula sem virar NaN", () => {
    expect(paraNumero("65,00") + paraNumero("20.00")).toBe(85);
  });

  it("vazio conta zero", () => {
    expect(paraNumero("")).toBe(0);
    expect(paraNumero(undefined)).toBe(0);
  });
});

describe("campoDinheiro", () => {
  it("aceita vírgula e entrega com ponto", () => {
    expect(campoDinheiro("220,00").parse("220,00")).toBe("220.00");
  });

  it("recusa texto que não é valor, com o exemplo em vírgula", () => {
    const resultado = campoDinheiro("220,00").safeParse("abc");
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0].message).toBe("Valor inválido (ex.: 220,00)");
  });

  it("o opcional aceita vazio", () => {
    expect(campoDinheiroOpcional("120,00").parse("")).toBe("");
  });
});
