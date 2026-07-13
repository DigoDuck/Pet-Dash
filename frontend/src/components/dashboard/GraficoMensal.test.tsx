import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PontoSerie } from "../../lib/types";
import { GraficoMensal } from "./GraficoMensal";

function ponto(competencia: string, faturamento: string, custos: string): PontoSerie {
  return {
    competencia,
    faturamento,
    custos,
    lucro: String(Number(faturamento) - Number(custos)),
  };
}

function alturas() {
  return screen.getAllByTestId("barra").map((barra) => barra.style.height);
}

describe("GraficoMensal", () => {
  it("mede cada barra contra a maior da série", () => {
    render(
      <GraficoMensal
        serie={[ponto("2026-05-01", "500.00", "250.00"), ponto("2026-06-01", "1000.00", "0.00")]}
        mesSelecionado="2026-06"
      />,
    );

    expect(alturas()).toEqual(["50%", "25%", "100%", "0%"]);
  });

  // Mês sem nenhum movimento zera o máximo da série: sem o guarda, 0/0 vira NaN e o
  // React renderiza height: NaN% — a barra some e o layout quebra sem erro no console.
  it("série toda zerada renderiza barras em 0%, sem NaN", () => {
    render(
      <GraficoMensal
        serie={[ponto("2026-05-01", "0.00", "0.00"), ponto("2026-06-01", "0.00", "0.00")]}
        mesSelecionado="2026-06"
      />,
    );

    expect(alturas()).toEqual(["0%", "0%", "0%", "0%"]);
  });

  it("expõe faturamento e custos de cada mês no rótulo acessível", () => {
    render(
      <GraficoMensal
        serie={[ponto("2026-06-01", "23194.00", "8145.00")]}
        mesSelecionado="2026-06"
      />,
    );

    expect(
      screen.getByRole("img", { name: "Jun: faturamento R$ 23,2k, custos R$ 8,1k" }),
    ).toBeInTheDocument();
  });

  it("destaca o mês selecionado entre os rótulos", () => {
    render(
      <GraficoMensal
        serie={[ponto("2026-05-01", "100.00", "10.00"), ponto("2026-06-01", "200.00", "20.00")]}
        mesSelecionado="2026-06"
      />,
    );

    expect(screen.getByText("Jun")).toHaveClass("text-marsala");
    expect(screen.getByText("Mai")).not.toHaveClass("text-marsala");
  });
});
