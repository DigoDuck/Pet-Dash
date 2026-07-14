import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderizarComProvedores } from "../test/utils";
import { server } from "../test/msw/server";
import { Servicos } from "./Servicos";

const BASE = "http://localhost:8000/api";

afterEach(() => vi.unstubAllGlobals());

function servico(over: Record<string, unknown> = {}) {
  return {
    id: 1, nome: "Banho", preco_padrao: "60.00", is_pacote: false,
    creditos: null, ativo: true, ...over,
  };
}

function paginado(results: unknown[]) {
  return { count: results.length, next: null, previous: null, results };
}

describe("Servicos", () => {
  it("lista os serviços da API", async () => {
    server.use(http.get(`${BASE}/servicos/`, () => HttpResponse.json(paginado([servico()]))));

    renderizarComProvedores(<Servicos />, { rota: "/servicos", caminho: "/servicos" });

    expect(await screen.findByText("Banho")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há serviços", async () => {
    server.use(http.get(`${BASE}/servicos/`, () => HttpResponse.json(paginado([]))));

    renderizarComProvedores(<Servicos />, { rota: "/servicos", caminho: "/servicos" });

    expect(await screen.findByText("Nenhum serviço ainda")).toBeInTheDocument();
  });

  it("o toggle de inativos muda o filtro ativo da query", async () => {
    const filtros: string[] = [];
    server.use(
      http.get(`${BASE}/servicos/`, ({ request }) => {
        filtros.push(new URL(request.url).searchParams.get("ativo") ?? "sem-filtro");
        return HttpResponse.json(paginado([servico()]));
      }),
    );

    renderizarComProvedores(<Servicos />, { rota: "/servicos", caminho: "/servicos" });
    await screen.findByText("Banho");

    await userEvent.click(screen.getByLabelText("Mostrar inativos"));

    await waitFor(() => expect(filtros).toContain("sem-filtro"));
    expect(filtros[0]).toBe("true");
  });

  it("cria um serviço pelo modal e fecha", async () => {
    let criados = 0;
    server.use(
      http.get(`${BASE}/servicos/`, () => HttpResponse.json(paginado([]))),
      http.post(`${BASE}/servicos/`, async () => {
        criados += 1;
        return HttpResponse.json(servico({ id: 9, nome: "Tosa" }), { status: 201 });
      }),
    );

    renderizarComProvedores(<Servicos />, { rota: "/servicos", caminho: "/servicos" });
    await screen.findByText("Nenhum serviço ainda");
    await userEvent.click(screen.getAllByRole("button", { name: "Novo serviço" })[0]);

    await userEvent.type(screen.getByLabelText("Nome"), "Tosa");
    await userEvent.type(screen.getByLabelText("Preço · pequeno (até 10 kg)"), "40.00");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(criados).toBe(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("desativa um serviço com PATCH ativo:false", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    let corpo: Record<string, unknown> | null = null;
    server.use(
      http.get(`${BASE}/servicos/`, () => HttpResponse.json(paginado([servico()]))),
      http.patch(`${BASE}/servicos/1/`, async ({ request }) => {
        corpo = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(servico({ ativo: false }));
      }),
    );

    renderizarComProvedores(<Servicos />, { rota: "/servicos", caminho: "/servicos" });
    await screen.findByText("Banho");

    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));

    await waitFor(() => expect(corpo).toEqual({ ativo: false }));
  });
});
