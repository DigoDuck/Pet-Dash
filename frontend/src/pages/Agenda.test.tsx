import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../test/msw/server";
import { renderizarComProvedores } from "../test/utils";
import { Agenda } from "./Agenda";

const BASE = "http://localhost:8000/api";

function atendimento(over: Record<string, unknown> = {}) {
  return {
    id: 1, pet: 7, pet_nome: "Luna", tutor_nome: "Ana Clara",
    servico: 1, servico_nome: "Banho", pacote: null,
    data: "2026-07-15", horario: "10:00:00", valor: "65.00",
    transporte: false, transporte_valor: "0.00", manejo_especial: false,
    status: "Pendente", pagamentos: [],
    ...over,
  };
}

function servir(results: unknown[], espiao?: (url: string) => void) {
  server.use(
    http.get(`${BASE}/atendimentos/`, ({ request }) => {
      espiao?.(request.url);
      return HttpResponse.json({ count: results.length, next: null, previous: null, results });
    }),
  );
}

function renderizar() {
  return renderizarComProvedores(<Agenda />, { rota: "/agenda", caminho: "/agenda" });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 6, 15)); // quarta, 15/07/2026
});

afterEach(() => vi.useRealTimers());

describe("Agenda", () => {
  it("pede a semana corrente (segunda a sábado) e desenha os atendimentos", async () => {
    let url = "";
    servir([atendimento()], (u) => (url = u));

    renderizar();

    expect(await screen.findByText("Luna")).toBeInTheDocument();
    // 15/07/2026 é quarta: a semana vai de segunda (13) a sábado (18).
    expect(url).toContain("data__gte=2026-07-13");
    expect(url).toContain("data__lte=2026-07-18");
  });

  it("navegar para a semana anterior refaz a consulta com o intervalo novo", async () => {
    const urls: string[] = [];
    servir([], (u) => urls.push(u));

    renderizar();
    await screen.findByText("Nenhum atendimento nesta semana.");

    await userEvent.click(screen.getByLabelText("Semana anterior"));

    await waitFor(() =>
      expect(urls.some((u) => u.includes("data__gte=2026-07-06"))).toBe(true),
    );
  });

  // O bug que uma grade fixa 8h–18h teria: o atendimento das 19h desaparece da tela
  // sem nenhum erro, e a Patricia descobre quando a cliente chega.
  it("um atendimento fora do horário padrão não some da grade", async () => {
    servir([atendimento({ horario: "19:30:00", pet_nome: "Thor" })]);

    renderizar();

    expect(await screen.findByText("Thor")).toBeInTheDocument();
    expect(screen.getByText("19h")).toBeInTheDocument();
  });

  it("o card leva para a edição do atendimento", async () => {
    servir([atendimento({ id: 42 })]);

    renderizar();

    expect(await screen.findByRole("link", { name: /Luna/ })).toHaveAttribute(
      "href",
      "/atendimentos/42/editar",
    );
  });
});
