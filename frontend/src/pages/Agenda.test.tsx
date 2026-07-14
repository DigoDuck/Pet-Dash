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
    id: 1, pet: 7, pet_nome: "Luna", tutor_nome: "Ana Clara", pet_vip: false,
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

    // "Luna" aparece duas vezes: no card da grade e na tabela de próximos.
    expect(await screen.findAllByText("Luna")).toHaveLength(2);
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

    expect(await screen.findAllByText("Thor")).not.toHaveLength(0);
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

  it("marca o pet VIP no card e na tabela", async () => {
    servir([atendimento({ pet_vip: true })]);

    renderizar();

    await screen.findAllByText("Luna");
    // Um no card da grade, outro na linha da tabela de próximos.
    expect(screen.getAllByText("VIP")).toHaveLength(2);
  });

  it("lista os próximos atendimentos da semana, sem os cancelados nem os passados", async () => {
    servir([
      atendimento({ id: 1, pet_nome: "Passado", data: "2026-07-13" }),
      atendimento({ id: 2, pet_nome: "Cancelado", data: "2026-07-17", status: "Cancelado" }),
      atendimento({ id: 3, pet_nome: "Futuro", data: "2026-07-17", servico_nome: "Tosa" }),
    ]);

    renderizar();

    expect(await screen.findByText("Próximos atendimentos")).toBeInTheDocument();
    const tabela = screen.getByRole("table");
    expect(tabela).toHaveTextContent("Futuro");
    expect(tabela).toHaveTextContent("Tosa");
    expect(tabela).toHaveTextContent("R$ 65,00");
    expect(tabela).not.toHaveTextContent("Passado");
    expect(tabela).not.toHaveTextContent("Cancelado");
  });
});
