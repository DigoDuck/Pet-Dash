import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { atendimento } from "../test/fixtures";
import { server } from "../test/msw/server";
import { renderizarComProvedores } from "../test/utils";
import { Agenda } from "./Agenda";

const BASE = "http://localhost:8000/api";

function servir(results: unknown[], espiao?: (url: string) => void, count?: number) {
  server.use(
    http.get(`${BASE}/atendimentos/`, ({ request }) => {
      espiao?.(request.url);
      return HttpResponse.json({
        count: count ?? results.length, next: null, previous: null, results,
      });
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
  it("pede a semana corrente (terça a domingo, buscando até a folga) e desenha os atendimentos", async () => {
    let url = "";
    servir([atendimento()], (u) => (url = u));

    renderizar();

    // "Luna" aparece duas vezes: no card da grade e na tabela de próximos.
    expect(await screen.findAllByText("Luna")).toHaveLength(2);
    // 15/07/2026 é quarta: a semana vai de terça (14) a domingo (19), e a busca
    // inclui a segunda de folga (20) para o atendimento excepcional não sumir.
    expect(url).toContain("data__gte=2026-07-14");
    expect(url).toContain("data__lte=2026-07-20");
    // Sem atendimento na folga, a coluna de segunda não existe.
    expect(screen.queryByText("Seg")).not.toBeInTheDocument();
  });

  it("navegar para a semana anterior refaz a consulta com o intervalo novo", async () => {
    const urls: string[] = [];
    servir([], (u) => urls.push(u));

    renderizar();
    await screen.findByText("Nenhum atendimento nesta semana.");

    await userEvent.click(screen.getByLabelText("Semana anterior"));

    await waitFor(() =>
      expect(urls.some((u) => u.includes("data__gte=2026-07-07"))).toBe(true),
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

  // O bug que o posicionamento só pela hora cheia tinha: 10:00 e 10:30 recebiam o
  // mesmo top e um card pintava por cima do outro — o atendimento sumia sem erro.
  it("atendimentos que se sobrepõem não ficam um em cima do outro", async () => {
    servir([
      atendimento({ id: 1, pet_nome: "Luna", horario: "10:00:00" }),
      atendimento({ id: 2, pet_nome: "Thor", horario: "10:30:00" }),
    ]);

    renderizar();

    const luna = await screen.findByRole("link", { name: /Luna/ });
    const thor = screen.getByRole("link", { name: /Thor/ });
    expect(luna.style.top).not.toBe(thor.style.top);
  });

  it("atendimentos no MESMO horário dividem a largura da coluna", async () => {
    servir([
      atendimento({ id: 1, pet_nome: "Luna", horario: "10:00:00" }),
      atendimento({ id: 2, pet_nome: "Thor", horario: "10:00:00" }),
    ]);

    renderizar();

    const luna = await screen.findByRole("link", { name: /Luna/ });
    const thor = screen.getByRole("link", { name: /Thor/ });
    expect(luna.style.top).toBe(thor.style.top);
    expect(luna.style.left).not.toBe(thor.style.left);
  });

  // A folga não é dia de trabalho, mas um encaixe excepcional marcado nela não pode
  // ficar invisível em todas as semanas — a coluna extra nasce só quando há dado.
  it("atendimento na segunda de folga abre a sétima coluna", async () => {
    servir([atendimento({ data: "2026-07-20", pet_nome: "Encaixe" })]);

    renderizar();

    expect(await screen.findAllByText("Encaixe")).not.toHaveLength(0);
    expect(screen.getByText("Seg")).toBeInTheDocument();
  });

  it("avisa quando a semana tem mais atendimentos do que a página traz", async () => {
    servir([atendimento()], undefined, 60);

    renderizar();

    expect(await screen.findByText(/mostra apenas 1/)).toBeInTheDocument();
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
