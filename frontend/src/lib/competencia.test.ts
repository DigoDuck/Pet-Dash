import { describe, expect, it } from "vitest";
import {
  formatarData,
  hojeISO,
  inicioDaCompetencia,
  mesCorrente,
  mesDaCompetencia,
  ultimoDiaDoMes,
} from "./competencia";

describe("competencia", () => {
  it("converte o mês do input para a competência do backend", () => {
    expect(inicioDaCompetencia("2026-07")).toBe("2026-07-01");
    expect(mesDaCompetencia("2026-07-01")).toBe("2026-07");
  });

  it("acha o último dia do mês, inclusive fevereiro bissexto", () => {
    expect(ultimoDiaDoMes("2026-07")).toBe("2026-07-31");
    expect(ultimoDiaDoMes("2026-02")).toBe("2026-02-28");
    expect(ultimoDiaDoMes("2028-02")).toBe("2028-02-29");
    expect(ultimoDiaDoMes("2026-12")).toBe("2026-12-31");
  });

  it("deriva mês e dia correntes da data local", () => {
    const hoje = new Date(2026, 6, 13); // 13/07/2026, hora local
    expect(mesCorrente(hoje)).toBe("2026-07");
    expect(hojeISO(hoje)).toBe("2026-07-13");
  });

  it("formata a data ISO para o padrão brasileiro", () => {
    expect(formatarData("2026-07-31")).toBe("31/07/2026");
  });
});
