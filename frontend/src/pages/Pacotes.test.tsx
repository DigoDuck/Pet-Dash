import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../test/msw/server";
import { renderizarComProvedores } from "../test/utils";
import { Pacotes } from "./Pacotes";

const BASE = "http://localhost:8000/api";

function pacote(over: Record<string, unknown> = {}) {
  return {
    id: 1, pet: 7, pet_nome: "Luna", tutor_nome: "Ana", servico: 5,
    servico_nome: "Pacote Fidelidade", competencia: "2026-07-01", qtd_total: 4,
    valor_pago: "220.00", data_compra: "2026-07-02", validade: "2026-07-31", saldo: 3,
    ...over,
  };
}

function paginado(results: unknown[]) {
  return { count: results.length, next: null, previous: null, results };
}

function renderizar() {
  return renderizarComProvedores(<Pacotes />, { rota: "/pacotes", caminho: "/pacotes" });
}

// toFake: ["Date"] falsifica só o relógio; o setTimeout do debounce continua real.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 6, 13)); // 13/07/2026
  server.use(
    http.get(`${BASE}/servicos/`, () =>
      HttpResponse.json(
        paginado([
          {
            id: 5, nome: "Pacote Fidelidade", preco_padrao: "220.00",
            is_pacote: true, creditos: 4, ativo: true,
          },
        ]),
      ),
    ),
    http.get(`${BASE}/pets/`, () =>
      HttpResponse.json(
        paginado([
          {
            id: 7, tutor: 3, tutor_nome: "Ana", nome: "Luna", raca: "", porte: "",
            ativo: true, created_at: "", vip: false, qtd_visitas: 0, total_gasto: "0.00",
          },
        ]),
      ),
    ),
  );
});

afterEach(() => vi.useRealTimers());

async function preencherVenda() {
  await userEvent.click(screen.getAllByRole("button", { name: "Vender pacote" })[0]);
  await screen.findByRole("option", { name: "Pacote Fidelidade" });

  await userEvent.type(screen.getByLabelText("Pet"), "Luna");
  await waitFor(() => expect(screen.getByText("Luna · Ana")).toBeInTheDocument());
  await userEvent.click(screen.getByText("Luna · Ana"));

  await userEvent.selectOptions(screen.getByLabelText("Serviço"), "5");
  await waitFor(() => expect(screen.getByLabelText("Valor pago")).toHaveValue("220.00"));
  await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
}

describe("Pacotes", () => {
  it("lista os pacotes da competência corrente com saldo e pet", async () => {
    let url = "";
    server.use(
      http.get(`${BASE}/pacotes/`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(paginado([pacote()]));
      }),
    );

    renderizar();

    expect(await screen.findByText("Luna")).toBeInTheDocument();
    expect(screen.getByText("3/4 créditos")).toBeInTheDocument();
    expect(url).toContain("competencia=2026-07-01");
  });

  // Limpar o campo mandava "" ao inicioDaCompetencia, que virava "-01" — string
  // truthy que ia para a query e voltava como 400 do DRF, derrubando a lista.
  it("limpar o campo de mês não dispara uma competência inválida", async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${BASE}/pacotes/`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(paginado([pacote()]));
      }),
    );

    renderizar();
    await screen.findByText("Luna");

    fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "" } });

    expect(urls.every((u) => u.includes("competencia=2026-07-01"))).toBe(true);
    expect(screen.getByLabelText("Mês")).toHaveValue("2026-07");
    expect(screen.getByText("Luna")).toBeInTheDocument();
  });

  it("mostra estado vazio quando o mês não tem pacote", async () => {
    server.use(http.get(`${BASE}/pacotes/`, () => HttpResponse.json(paginado([]))));

    renderizar();

    expect(await screen.findByText("Nenhum pacote neste mês")).toBeInTheDocument();
  });

  it("vende um pacote pelo modal e fecha", async () => {
    let corpo: Record<string, unknown> | null = null;
    server.use(
      http.get(`${BASE}/pacotes/`, () => HttpResponse.json(paginado([]))),
      http.post(`${BASE}/pacotes/`, async ({ request }) => {
        corpo = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(pacote(), { status: 201 });
      }),
    );

    renderizar();
    await screen.findByText("Nenhum pacote neste mês");
    await preencherVenda();

    await waitFor(() =>
      expect(corpo).toMatchObject({ pet: 7, servico: 5, competencia: "2026-07-01" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("venda duplicada mostra a mensagem do backend dentro do modal", async () => {
    server.use(
      http.get(`${BASE}/pacotes/`, () => HttpResponse.json(paginado([]))),
      http.post(`${BASE}/pacotes/`, () =>
        HttpResponse.json(
          { non_field_errors: ["Já existe um pacote para este pet nesta competência."] },
          { status: 400 },
        ),
      ),
    );

    renderizar();
    await screen.findByText("Nenhum pacote neste mês");
    await preencherVenda();

    expect(
      await screen.findByText("Já existe um pacote para este pet nesta competência."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
