import { describe, expect, it } from "vitest";
import {
  diasDaSemana,
  formatarData,
  hojeISO,
  inicioDaCompetencia,
  inicioDaSemana,
  mesCorrente,
  mesCurto,
  mesDaCompetencia,
  mesesAnteriores,
  somarDias,
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

describe("mesesAnteriores", () => {
  it("devolve os N meses terminando no mês pedido, em ordem cronológica", () => {
    expect(mesesAnteriores("2026-07", 6)).toEqual([
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
    ]);
  });

  it("atravessa a virada de ano", () => {
    expect(mesesAnteriores("2026-02", 6)).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("com N = 1 devolve só o próprio mês", () => {
    expect(mesesAnteriores("2026-01", 1)).toEqual(["2026-01"]);
  });
});

describe("mesCurto", () => {
  it("rotula a competência com o mês abreviado", () => {
    expect(mesCurto("2026-01-01")).toBe("Jan");
    expect(mesCurto("2026-12-01")).toBe("Dez");
  });
});

describe("inicioDaSemana", () => {
  // A semana do spa é terça a domingo; a folga é a segunda.
  it("recua até a terça-feira da semana", () => {
    expect(inicioDaSemana("2026-07-15")).toBe("2026-07-14"); // quarta
    expect(inicioDaSemana("2026-07-14")).toBe("2026-07-14"); // a própria terça
    expect(inicioDaSemana("2026-07-18")).toBe("2026-07-14"); // sábado
  });

  it("domingo fecha a semana que começou na terça anterior", () => {
    expect(inicioDaSemana("2026-07-19")).toBe("2026-07-14");
  });

  it("na segunda de folga adianta para a semana que começa amanhã", () => {
    expect(inicioDaSemana("2026-07-20")).toBe("2026-07-21");
  });

  it("atravessa a virada de mês", () => {
    expect(inicioDaSemana("2026-08-01")).toBe("2026-07-28"); // sábado 01/08
  });
});

describe("dias da semana", () => {
  it("enumera os N dias a partir do início", () => {
    expect(diasDaSemana("2026-07-14", 6)).toEqual([
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
      "2026-07-18",
      "2026-07-19",
    ]);
  });

  it("soma e subtrai dias atravessando o mês", () => {
    expect(somarDias("2026-07-28", 7)).toBe("2026-08-04");
    expect(somarDias("2026-08-04", -7)).toBe("2026-07-28");
  });
});
