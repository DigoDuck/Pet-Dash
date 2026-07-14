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
  qtd_atendimentos: 134,
  pets_ativos: 89,
  vip: [],
  top_tutores: [],
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

const TRANSACOES = [
  { tipo: "pacote", descricao: "Pacote Fidelidade · Mel", valor: "220.00", data: "2026-07-12" },
  { tipo: "atendimento", descricao: "Banho e tosa · Luna", valor: "95.00", data: "2026-07-10" },
  { tipo: "retirada", descricao: "Pró-labore", valor: "2000.00", data: "2026-07-05" },
  { tipo: "custo", descricao: "Aluguel", valor: "1200.00", data: "2026-07-01" },
];

function servirTudo(serie = SERIE) {
  server.use(
    http.get(`${BASE}/dashboard/`, () => HttpResponse.json(RESUMO)),
    http.get(`${BASE}/dashboard/serie/`, () => HttpResponse.json(serie)),
    http.get(`${BASE}/dashboard/transacoes/`, () => HttpResponse.json(TRANSACOES)),
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
  it("busca os KPIs, a série dos 6 meses que terminam no mês, e o feed", async () => {
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
      http.get(`${BASE}/dashboard/transacoes/`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(TRANSACOES);
      }),
    );

    renderizar();

    await screen.findByText("R$ 8000,00");
    // Fevereiro é o primeiro dos 6 meses terminando em julho; KPIs e feed olham só julho.
    expect(urls.filter((u) => u.includes("inicio=2026-07-01&fim=2026-07-31"))).toHaveLength(2);
    expect(urls.some((u) => u.includes("inicio=2026-02-01&fim=2026-07-31"))).toBe(true);
  });

  it("o hero mostra o faturamento e leva às duas ações que existem", async () => {
    servirTudo();

    renderizar();

    expect(await screen.findByText("R$ 8000,00")).toBeInTheDocument();
    expect(screen.getByText(/Lucro de/)).toHaveTextContent("Lucro de R$ 6500,00 · margem de 81,3%");
    expect(screen.getByRole("link", { name: /Novo atendimento/ })).toHaveAttribute(
      "href",
      "/atendimentos/novo",
    );
    expect(screen.getByRole("link", { name: /Lançar custo/ })).toHaveAttribute(
      "href",
      "/financeiro",
    );
  });

  it("mostra os contadores de visitas e de pets ativos", async () => {
    servirTudo();

    renderizar();

    expect(await screen.findByText("134")).toBeInTheDocument();
    expect(screen.getByText("Visitas liberadas no mês")).toBeInTheDocument();
    expect(screen.getByText("89")).toBeInTheDocument();
  });

  it("o feed traz entrada com + e saída com −, e data de custo como competência", async () => {
    servirTudo();

    renderizar();

    expect(await screen.findByText("+ R$ 95,00")).toBeInTheDocument();
    expect(screen.getByText("+ R$ 220,00")).toBeInTheDocument();
    expect(screen.getByText("− R$ 2000,00")).toBeInTheDocument();
    expect(screen.getByText("− R$ 1200,00")).toBeInTheDocument();
    // Custo tem competência (dia 1 sintético), não data de pagamento: "01/07/2026" seria
    // afirmar um dia que ninguém registrou.
    expect(screen.getByText("Custo · Jul/2026")).toBeInTheDocument();
    expect(screen.getByText("Serviço · 10/07/2026")).toBeInTheDocument();
  });

  it("calcula o crescimento contra o mês anterior a partir da série", async () => {
    servirTudo();

    renderizar();

    // 8000 vs 7500 em junho = +6,7%. Nenhuma query nova: sai da série do gráfico.
    expect(await screen.findByText("+6,7%")).toBeInTheDocument();
    expect(screen.getByText("Faturamento vs Jun")).toBeInTheDocument();
  });

  // Divisão por zero: com o mês anterior zerado, (8000-0)/0 é Infinity, e "+∞%" numa
  // tela de dinheiro é pior do que não mostrar nada.
  it("não mostra crescimento quando o mês anterior foi zero", async () => {
    servirTudo([
      { competencia: "2026-06-01", faturamento: "0.00", custos: "0.00", lucro: "0.00" },
      { competencia: "2026-07-01", faturamento: "8000.00", custos: "1500.00", lucro: "6500.00" },
    ]);

    renderizar();

    await screen.findByText("R$ 8000,00");
    expect(screen.queryByText(/Infinity|NaN|∞/)).not.toBeInTheDocument();
    expect(screen.getByText("Crescimento").parentElement).toHaveTextContent("—");
  });

  it("trocar o mês refaz as três consultas e desloca a janela do gráfico", async () => {
    const urls: string[] = [];
    const capturar = ({ request }: { request: Request }) => {
      urls.push(request.url);
      return HttpResponse.json(RESUMO);
    };
    server.use(
      http.get(`${BASE}/dashboard/`, capturar),
      http.get(`${BASE}/dashboard/serie/`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(SERIE);
      }),
      http.get(`${BASE}/dashboard/transacoes/`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(TRANSACOES);
      }),
    );

    renderizar();
    await screen.findByText("R$ 8000,00");

    fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "2026-06" } });

    await waitFor(() => {
      expect(urls.filter((u) => u.includes("inicio=2026-06-01&fim=2026-06-30"))).toHaveLength(2);
      // A janela do gráfico anda junto: 6 meses terminando em junho começam em janeiro.
      expect(urls.some((u) => u.includes("inicio=2026-01-01&fim=2026-06-30"))).toBe(true);
    });
  });

  it("erro nos KPIs mostra traço, nunca R$ 0,00", async () => {
    server.use(
      http.get(`${BASE}/dashboard/`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${BASE}/dashboard/serie/`, () => HttpResponse.json(SERIE)),
      http.get(`${BASE}/dashboard/transacoes/`, () => HttpResponse.json(TRANSACOES)),
    );

    renderizar();

    // Hero + 4 KPIs + 2 contadores; o crescimento vem da série, que não falhou.
    await waitFor(() => expect(screen.getAllByText("—")).toHaveLength(7));
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });

  it("erro no feed não derruba o hero nem o gráfico (blocos independentes)", async () => {
    server.use(
      http.get(`${BASE}/dashboard/`, () => HttpResponse.json(RESUMO)),
      http.get(`${BASE}/dashboard/serie/`, () => HttpResponse.json(SERIE)),
      http.get(`${BASE}/dashboard/transacoes/`, () => new HttpResponse(null, { status: 500 })),
    );

    renderizar();

    expect(
      await screen.findByText("Não foi possível carregar as movimentações."),
    ).toBeInTheDocument();
    expect(screen.getByText("R$ 8000,00")).toBeInTheDocument();
    expect(screen.getByText("Fluxo de caixa")).toBeInTheDocument();
  });

  it("mês sem movimentação mostra os vazios sem quebrar", async () => {
    server.use(
      http.get(`${BASE}/dashboard/`, () =>
        HttpResponse.json({
          ...RESUMO,
          faturamento: "0.00",
          custos: "0.00",
          retiradas: "0.00",
          lucro: "0.00",
          ticket_medio: "0.00",
          margem: "0.0000",
          qtd_atendimentos: 0,
          custos_por_categoria: [],
        }),
      ),
      http.get(`${BASE}/dashboard/serie/`, () => HttpResponse.json([])),
      http.get(`${BASE}/dashboard/transacoes/`, () => HttpResponse.json([])),
    );

    renderizar();

    expect(await screen.findByText("Nenhuma movimentação neste mês.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum custo lançado neste mês.")).toBeInTheDocument();
    expect(screen.getByText("Margem de 0,0%")).toBeInTheDocument();
  });
});
