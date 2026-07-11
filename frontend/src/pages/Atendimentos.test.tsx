import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderizarComProvedores } from "../test/utils";
import { server } from "../test/msw/server";
import { Atendimentos } from "./Atendimentos";

const BASE = "http://localhost:8000/api";

afterEach(() => vi.unstubAllGlobals());

function atendimento(over: Record<string, unknown> = {}) {
  return {
    id: 1, pet: 7, pet_nome: "Luna", tutor_nome: "Ana Clara", servico: 1, servico_nome: "Banho",
    pacote: null, data: "2026-07-08", horario: "10:00:00", valor: "60.00",
    transporte: false, transporte_valor: "0.00", status: "Pendente", pagamentos: [], ...over,
  };
}

function paginado(results: unknown[]) {
  return { count: results.length, next: null, previous: null, results };
}

describe("Atendimentos", () => {
  it("lista os atendimentos com pet e tutor", async () => {
    server.use(http.get(`${BASE}/atendimentos/`, () => HttpResponse.json(paginado([atendimento()]))));

    renderizarComProvedores(<Atendimentos />, { rota: "/atendimentos", caminho: "/atendimentos" });

    expect(await screen.findByText("Luna")).toBeInTheDocument();
    expect(screen.getByText("Ana Clara")).toBeInTheDocument();
  });

  it("filtra por status", async () => {
    const statuses: string[] = [];
    server.use(
      http.get(`${BASE}/atendimentos/`, ({ request }) => {
        statuses.push(new URL(request.url).searchParams.get("status") ?? "");
        return HttpResponse.json(paginado([atendimento()]));
      }),
    );

    renderizarComProvedores(<Atendimentos />, { rota: "/atendimentos", caminho: "/atendimentos" });
    await screen.findByText("Luna");

    await userEvent.selectOptions(screen.getByLabelText("Status"), "Liberado");

    await waitFor(() => expect(statuses).toContain("Liberado"));
  });

  it("marca como liberado pela ação da linha", async () => {
    let corpo: Record<string, unknown> | null = null;
    server.use(
      http.get(`${BASE}/atendimentos/`, () => HttpResponse.json(paginado([atendimento()]))),
      http.patch(`${BASE}/atendimentos/1/`, async ({ request }) => {
        corpo = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(atendimento({ status: "Liberado" }));
      }),
    );

    renderizarComProvedores(<Atendimentos />, { rota: "/atendimentos", caminho: "/atendimentos" });
    await screen.findByText("Luna");

    await userEvent.click(screen.getByRole("button", { name: "Liberar" }));

    await waitFor(() => expect(corpo).toEqual({ status: "Liberado" }));
  });

  it("cancelar pede confirmação", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    let corpo: Record<string, unknown> | null = null;
    server.use(
      http.get(`${BASE}/atendimentos/`, () => HttpResponse.json(paginado([atendimento()]))),
      http.patch(`${BASE}/atendimentos/1/`, async ({ request }) => {
        corpo = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(atendimento({ status: "Cancelado" }));
      }),
    );

    renderizarComProvedores(<Atendimentos />, { rota: "/atendimentos", caminho: "/atendimentos" });
    await screen.findByText("Luna");

    await userEvent.click(screen.getByRole("button", { name: "Cancelar atendimento" }));

    await waitFor(() => expect(corpo).toEqual({ status: "Cancelado" }));
  });
});
