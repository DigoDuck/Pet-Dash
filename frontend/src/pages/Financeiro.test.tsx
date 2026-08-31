import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../test/msw/server";
import { renderizarComProvedores } from "../test/utils";
import { Financeiro } from "./Financeiro";

const BASE = "http://localhost:8000/api";

function paginado(results: unknown[]) {
  return { count: results.length, next: null, previous: null, results };
}

function custo(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    tipo: "fixo",
    descricao: "Aluguel",
    valor: "1200.00",
    categoria: "Estrutura",
    competencia: "2026-07-01",
    ...over,
  };
}

function retirada(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    descricao: "Pró-labore",
    valor: "2000.00",
    data: "2026-07-05",
    tipo: "mensal",
    ...over,
  };
}

const RESUMO = {
  faturamento: "8000.00",
  transporte: "710.00",
  // Recorte de `custos`, não parcela extra: 280 dos 1500 são transporte.
  custo_transporte: "280.00",
  custos: "1500.00",
  retiradas: "2000.00",
  lucro: "6500.00",
  ticket_medio: "80.00",
  margem: "0.8125",
};

function renderizar() {
  return renderizarComProvedores(<Financeiro />, { rota: "/financeiro", caminho: "/financeiro" });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 6, 13)); // 13/07/2026
});

afterEach(() => vi.useRealTimers());

describe("Financeiro", () => {
  it("lista custos por competência e retiradas por intervalo do mês corrente", async () => {
    let urlCustos = "";
    let urlRetiradas = "";
    server.use(
      http.get(`${BASE}/custos/`, ({ request }) => {
        urlCustos = request.url;
        return HttpResponse.json(paginado([custo()]));
      }),
      http.get(`${BASE}/retiradas/`, ({ request }) => {
        urlRetiradas = request.url;
        return HttpResponse.json(paginado([retirada()]));
      }),
      http.get(`${BASE}/dashboard/`, () => HttpResponse.json(RESUMO)),
    );

    renderizar();

    expect(await screen.findByText("Aluguel")).toBeInTheDocument();
    expect(await screen.findByText("Pró-labore")).toBeInTheDocument();
    expect(urlCustos).toContain("competencia=2026-07-01");
    expect(urlRetiradas).toContain("data__gte=2026-07-01");
    expect(urlRetiradas).toContain("data__lte=2026-07-31");
  });

  // O card é o total do mês vindo do backend, não a soma das linhas visíveis: a
  // fixture tem uma única linha de 1200,00 e um total de 1500,00 de propósito.
  it("os totais vêm do dashboard, não da soma da tabela", async () => {
    server.use(
      http.get(`${BASE}/custos/`, () => HttpResponse.json(paginado([custo()]))),
      http.get(`${BASE}/retiradas/`, () => HttpResponse.json(paginado([]))),
      http.get(`${BASE}/dashboard/`, () => HttpResponse.json(RESUMO)),
    );

    renderizar();

    expect(await screen.findByText("R$ 1500,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 2000,00")).toBeInTheDocument();
  });

  // A pergunta da Patricia é "o triciclo se paga?", e ela não é respondida por
  // nenhum dos dois números sozinho: a receita da corrida vive dentro do
  // faturamento, o custo dela vive diluído no total de custos.
  it("o bloco de transporte mostra corrida, custo e saldo do mês", async () => {
    server.use(
      http.get(`${BASE}/custos/`, () => HttpResponse.json(paginado([custo()]))),
      http.get(`${BASE}/retiradas/`, () => HttpResponse.json(paginado([]))),
      http.get(`${BASE}/dashboard/`, () => HttpResponse.json(RESUMO)),
    );

    renderizar();

    expect(await screen.findByText("+ R$ 710,00")).toBeInTheDocument();
    expect(screen.getByText("− R$ 280,00")).toBeInTheDocument();
    expect(screen.getByText("+ R$ 430,00")).toBeInTheDocument();
    // O custo do transporte é um recorte do total, não uma despesa a mais.
    expect(screen.getByText("R$ 1500,00")).toBeInTheDocument();
    expect(screen.getByText("Transporte: R$ 280,00")).toBeInTheDocument();
  });

  it("transporte no vermelho aparece com o sinal invertido", async () => {
    server.use(
      http.get(`${BASE}/custos/`, () => HttpResponse.json(paginado([]))),
      http.get(`${BASE}/retiradas/`, () => HttpResponse.json(paginado([]))),
      http.get(`${BASE}/dashboard/`, () =>
        HttpResponse.json({ ...RESUMO, transporte: "100.00", custo_transporte: "180.00" }),
      ),
    );

    renderizar();

    // "− R$ 80,00", e não o "R$ -80,00" que o formatarPreco produziria sozinho.
    expect(await screen.findByText("− R$ 80,00")).toBeInTheDocument();
  });

  // Zero é um número: com o dashboard fora do ar, o bloco não pode afirmar que o
  // triciclo se pagou. Mesma regra do KpiCard.
  it("dashboard fora do ar mostra traço no bloco de transporte, não zero", async () => {
    server.use(
      http.get(`${BASE}/custos/`, () => HttpResponse.json(paginado([custo()]))),
      http.get(`${BASE}/retiradas/`, () => HttpResponse.json(paginado([]))),
      http.get(`${BASE}/dashboard/`, () => new HttpResponse(null, { status: 500 })),
    );

    renderizar();

    await screen.findByText("Aluguel");
    await waitFor(() => expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3));
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });

  it("trocar o mês refaz as três consultas com o novo intervalo", async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${BASE}/custos/`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(paginado([]));
      }),
      http.get(`${BASE}/retiradas/`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(paginado([]));
      }),
      http.get(`${BASE}/dashboard/`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(RESUMO);
      }),
    );

    renderizar();
    await screen.findByText("Nenhum custo neste mês");

    // fireEvent.change, e não userEvent.type: o seletor de mês do navegador emite
    // um único change com o valor completo, nunca os parciais ("2", "20", "202")
    // que a digitação tecla a tecla produziria.
    fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "2026-06" } });

    await waitFor(() => {
      expect(urls.some((u) => u.includes("competencia=2026-06-01"))).toBe(true);
      expect(
        urls.some((u) => u.includes("data__gte=2026-06-01") && u.includes("data__lte=2026-06-30")),
      ).toBe(true);
      expect(urls.some((u) => u.includes("inicio=2026-06-01") && u.includes("fim=2026-06-30"))).toBe(
        true,
      );
    });
  });

  // Limpar o campo (botão do navegador) mandava "" ao ultimoDiaDoMes, que virava
  // Invalid Date e derrubava a página inteira com RangeError.
  it("limpar o campo de mês não derruba a tela", async () => {
    server.use(
      http.get(`${BASE}/custos/`, () => HttpResponse.json(paginado([custo()]))),
      http.get(`${BASE}/retiradas/`, () => HttpResponse.json(paginado([]))),
      http.get(`${BASE}/dashboard/`, () => HttpResponse.json(RESUMO)),
    );

    renderizar();
    await screen.findByText("Aluguel");

    fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "" } });
    fireEvent.blur(screen.getByLabelText("Mês"));

    expect(screen.getByLabelText("Mês")).toHaveValue("2026-07");
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
  });

  it("o filtro de tipo requisita ?tipo=", async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${BASE}/custos/`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(paginado([custo()]));
      }),
      http.get(`${BASE}/retiradas/`, () => HttpResponse.json(paginado([]))),
      http.get(`${BASE}/dashboard/`, () => HttpResponse.json(RESUMO)),
    );

    renderizar();
    await screen.findByText("Aluguel");

    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "variavel");

    await waitFor(() => expect(urls.some((u) => u.includes("tipo=variavel"))).toBe(true));
  });

  // Diálogo do app, não window.confirm: o nativo não aparecia no Firefox da Patricia.
  it("excluir pede confirmação e não chama a API se o usuário voltar", async () => {
    let chamouDelete = false;
    server.use(
      http.get(`${BASE}/custos/`, () => HttpResponse.json(paginado([custo()]))),
      http.get(`${BASE}/retiradas/`, () => HttpResponse.json(paginado([]))),
      http.get(`${BASE}/dashboard/`, () => HttpResponse.json(RESUMO)),
      http.delete(`${BASE}/custos/1/`, () => {
        chamouDelete = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderizar();
    await screen.findByText("Aluguel");

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    const dialogo = await screen.findByRole("dialog");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Voltar" }));

    expect(chamouDelete).toBe(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("excluir confirmado remove o custo", async () => {
    let chamouDelete = false;
    server.use(
      http.get(`${BASE}/custos/`, () =>
        HttpResponse.json(paginado(chamouDelete ? [] : [custo()])),
      ),
      http.get(`${BASE}/retiradas/`, () => HttpResponse.json(paginado([]))),
      http.get(`${BASE}/dashboard/`, () => HttpResponse.json(RESUMO)),
      http.delete(`${BASE}/custos/1/`, () => {
        chamouDelete = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderizar();
    await screen.findByText("Aluguel");

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    const dialogo = await screen.findByRole("dialog");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(chamouDelete).toBe(true));
    expect(await screen.findByText("Nenhum custo neste mês")).toBeInTheDocument();
  });
});
