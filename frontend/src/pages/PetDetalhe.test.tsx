import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { renderizarComProvedores } from "../test/utils";
import { server } from "../test/msw/server";
import { PetDetalhe } from "./PetDetalhe";

const BASE = "http://localhost:8000/api";

function petJson(vip: boolean) {
  return {
    id: 7, tutor: 1, tutor_nome: "Ana Clara", nome: "Luna", raca: "Shih Tzu", porte: "P",
    ativo: true, created_at: "2026-07-01", vip, qtd_visitas: vip ? 3 : 1, total_gasto: "150.00",
  };
}

const SEM_ATENDIMENTOS = { count: 0, next: null, previous: null, results: [] };

function montar() {
  return renderizarComProvedores(<PetDetalhe />, { rota: "/pets/7", caminho: "/pets/:id" });
}

describe("PetDetalhe", () => {
  it("mostra o badge VIP quando o pet é VIP", async () => {
    server.use(
      http.get(`${BASE}/pets/7/`, () => HttpResponse.json(petJson(true))),
      http.get(`${BASE}/atendimentos/`, () => HttpResponse.json(SEM_ATENDIMENTOS)),
    );

    montar();

    expect(await screen.findByText("VIP")).toBeInTheDocument();
  });

  it("não mostra o badge VIP quando o pet não é VIP", async () => {
    server.use(
      http.get(`${BASE}/pets/7/`, () => HttpResponse.json(petJson(false))),
      http.get(`${BASE}/atendimentos/`, () => HttpResponse.json(SEM_ATENDIMENTOS)),
    );

    montar();

    await screen.findByRole("heading", { name: "Luna" });
    expect(screen.queryByText("VIP")).not.toBeInTheDocument();
  });

  it("pagina o histórico e pede a página 2", async () => {
    const paginas: string[] = [];
    server.use(
      http.get(`${BASE}/pets/7/`, () => HttpResponse.json(petJson(true))),
      http.get(`${BASE}/atendimentos/`, ({ request }) => {
        paginas.push(new URL(request.url).searchParams.get("page") ?? "");
        return HttpResponse.json({
          count: 120, next: "x", previous: null,
          results: [
            {
              id: 1, pet: 7, servico: 1, servico_nome: "Banho", pacote: null,
              data: "2026-07-01", horario: "10:00:00", valor: "95.00",
              transporte: false, transporte_valor: "0.00", status: "Liberado", pagamentos: [],
            },
          ],
        });
      }),
    );

    montar();

    expect(await screen.findByText("Página 1 de 3")).toBeInTheDocument();
    expect(paginas).toContain("1");

    await userEvent.click(screen.getByRole("button", { name: "Próxima" }));

    await waitFor(() => expect(paginas).toContain("2"));
    expect(await screen.findByText("Página 2 de 3")).toBeInTheDocument();
  });

  it("mostra estado vazio quando o pet não tem histórico", async () => {
    server.use(
      http.get(`${BASE}/pets/7/`, () => HttpResponse.json(petJson(false))),
      http.get(`${BASE}/atendimentos/`, () => HttpResponse.json(SEM_ATENDIMENTOS)),
    );

    montar();

    expect(await screen.findByText("Nenhum atendimento ainda")).toBeInTheDocument();
  });
});
