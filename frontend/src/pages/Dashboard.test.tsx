import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../test/msw/server";
import { renderizarComProvedores } from "../test/utils";
import { Dashboard } from "./Dashboard";

const BASE = "http://localhost:8000/api";

const RESUMO = {
  faturamento: "8000.00",
  custos: "1500.00",
  retiradas: "2000.00",
  lucro: "6500.00",
  ticket_medio: "80.00",
  margem: "0.8125",
  vip: [
    {
      id: 7,
      tutor: 3,
      tutor_nome: "Ana Clara",
      nome: "Luna",
      raca: "SRD",
      porte: "M",
      ativo: true,
      created_at: "2026-01-01",
      vip: true,
      qtd_visitas: 4,
      total_gasto: "600.00",
    },
  ],
  top_tutores: [{ id: 3, nome: "Ana Clara", gasto_total: "600.00" }],
  custos_por_categoria: [
    { categoria: "Aluguel", valor: "1200.00" },
    { categoria: "Insumos", valor: "300.00" },
  ],
};

const SERIE = [
  { competencia: "2026-02-01", faturamento: "5000.00", custos: "1000.00", lucro: "4000.00" },
  { competencia: "2026-03-01", faturamento: "6000.00", custos: "1100.00", lucro: "4900.00" },
  { competencia: "2026-04-01", faturamento: "7000.00", custos: "1200.00", lucro: "5800.00" },
  { competencia: "2026-05-01", faturamento: "0.00", custos: "0.00", lucro: "0.00" },
  { competencia: "2026-06-01", faturamento: "7500.00", custos: "1400.00", lucro: "6100.00" },
  { competencia: "2026-07-01", faturamento: "8000.00", custos: "1500.00", lucro: "6500.00" },
];

function servirTudo() {
  server.use(
    http.get(`${BASE}/dashboard/`, () => HttpResponse.json(RESUMO)),
    http.get(`${BASE}/dashboard/serie/`, () => HttpResponse.json(SERIE)),
  );
}

function renderizar() {
  return renderizarComProvedores(<Dashboard />, { rota: "/", caminho: "/" });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 6, 13)); // 13/07/2026
});

afterEach(() => vi.useRealTimers());

describe("Dashboard", () => {
  it("busca os KPIs do mês corrente e a série dos 6 meses que terminam nele", async () => {
    let urlResumo = "";
    let urlSerie = "";
    server.use(
      http.get(`${BASE}/dashboard/`, ({ request }) => {
        urlResumo = request.url;
        return HttpResponse.json(RESUMO);
      }),
      http.get(`${BASE}/dashboard/serie/`, ({ request }) => {
        urlSerie = request.url;
        return HttpResponse.json(SERIE);
      }),
    );

    renderizar();

    expect(await screen.findByText("R$ 8000,00")).toBeInTheDocument();
    expect(urlResumo).toContain("inicio=2026-07-01");
    expect(urlResumo).toContain("fim=2026-07-31");
    // Fevereiro é o primeiro dos 6 meses terminando em julho.
    expect(urlSerie).toContain("inicio=2026-02-01");
    expect(urlSerie).toContain("fim=2026-07-31");
  });

  it("mostra os cinco KPIs, com a margem convertida de fração para percentual", async () => {
    servirTudo();

    renderizar();

    expect(await screen.findByText("R$ 8000,00")).toBeInTheDocument(); // faturamento
    expect(screen.getByText("R$ 6500,00")).toBeInTheDocument(); // lucro
    expect(screen.getByText("R$ 80,00")).toBeInTheDocument(); // ticket médio
    expect(screen.getByText("R$ 2000,00")).toBeInTheDocument(); // retiradas
    // "0.8125" vem como fração do backend; a tela é quem converte.
    expect(screen.getByText("Margem de 81,3%")).toBeInTheDocument();
  });

  it("trocar o mês refaz as duas consultas e desloca a janela do gráfico", async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${BASE}/dashboard/`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(RESUMO);
      }),
      http.get(`${BASE}/dashboard/serie/`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(SERIE);
      }),
    );

    renderizar();
    await screen.findByText("R$ 8000,00");

    fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "2026-06" } });

    await waitFor(() => {
      expect(urls.some((u) => u.includes("inicio=2026-06-01") && u.includes("fim=2026-06-30"))).toBe(
        true,
      );
      // A janela do gráfico anda junto: 6 meses terminando em junho começam em janeiro.
      expect(urls.some((u) => u.includes("inicio=2026-01-01") && u.includes("fim=2026-06-30"))).toBe(
        true,
      );
    });
  });

  it("renderiza o gráfico, os top tutores e os pets VIP", async () => {
    servirTudo();

    renderizar();

    expect(
      await screen.findByRole("img", { name: "Jul: faturamento R$ 8,0k, custos R$ 1,5k" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Top tutores do mês")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ana Clara" })).toHaveAttribute("href", "/clientes/3");
    expect(screen.getByRole("link", { name: "Luna" })).toHaveAttribute("href", "/pets/7");
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
  });

  it("erro nos KPIs mostra traço, nunca R$ 0,00", async () => {
    server.use(
      http.get(`${BASE}/dashboard/`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${BASE}/dashboard/serie/`, () => HttpResponse.json(SERIE)),
    );

    renderizar();

    await waitFor(() => expect(screen.getAllByText("—")).toHaveLength(5));
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });

  it("erro na série não derruba os KPIs (blocos independentes)", async () => {
    server.use(
      http.get(`${BASE}/dashboard/`, () => HttpResponse.json(RESUMO)),
      http.get(`${BASE}/dashboard/serie/`, () => new HttpResponse(null, { status: 500 })),
    );

    renderizar();

    expect(await screen.findByText("Não foi possível carregar o gráfico.")).toBeInTheDocument();
    expect(screen.getByText("R$ 8000,00")).toBeInTheDocument();
    expect(screen.getByText("Top tutores do mês")).toBeInTheDocument();
  });

  it("mês sem VIP, sem tutor e sem custo mostra os vazios sem quebrar", async () => {
    server.use(
      http.get(`${BASE}/dashboard/`, () =>
        HttpResponse.json({
          faturamento: "0.00",
          custos: "0.00",
          retiradas: "0.00",
          lucro: "0.00",
          ticket_medio: "0.00",
          margem: "0.0000",
          vip: [],
          top_tutores: [],
          custos_por_categoria: [],
        }),
      ),
      http.get(`${BASE}/dashboard/serie/`, () => HttpResponse.json([])),
    );

    renderizar();

    expect(await screen.findByText("Nenhum pet atingiu o critério neste mês.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum atendimento liberado neste mês.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum custo lançado neste mês.")).toBeInTheDocument();
    expect(screen.getByText("Margem de 0,0%")).toBeInTheDocument();
  });
});
