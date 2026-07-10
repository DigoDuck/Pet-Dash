import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderizarComProvedores } from "../test/utils";
import { server } from "../test/msw/server";
import { TutorDetalhe } from "./TutorDetalhe";

const BASE = "http://localhost:8000/api";

const TUTOR = { id: 1, nome: "Ana Clara", telefone: "71988880001", email: "", ativo: true, created_at: "2026-07-01" };

function pet(id: number, nome: string, vip: boolean) {
  return {
    id, tutor: 1, tutor_nome: "Ana Clara", nome, raca: "SRD", porte: "M",
    ativo: true, created_at: "2026-07-01", vip, qtd_visitas: vip ? 3 : 0, total_gasto: "0.00",
  };
}

function montar() {
  return renderizarComProvedores(<TutorDetalhe />, {
    rota: "/clientes/1",
    caminho: "/clientes/:id",
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("TutorDetalhe", () => {
  it("mostra o tutor e seus pets, com badge VIP só em quem é VIP", async () => {
    server.use(
      http.get(`${BASE}/tutores/1/`, () => HttpResponse.json(TUTOR)),
      http.get(`${BASE}/pets/`, () =>
        HttpResponse.json({
          count: 2, next: null, previous: null,
          results: [pet(7, "Luna", true), pet(8, "Thor", false)],
        }),
      ),
    );

    montar();

    expect(await screen.findByRole("heading", { name: "Ana Clara" })).toBeInTheDocument();
    expect(screen.getByText("Luna")).toBeInTheDocument();
    expect(screen.getAllByText("VIP")).toHaveLength(1);
  });

  it("mostra estado vazio quando o tutor não tem pets", async () => {
    server.use(
      http.get(`${BASE}/tutores/1/`, () => HttpResponse.json(TUTOR)),
      http.get(`${BASE}/pets/`, () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
    );

    montar();

    expect(await screen.findByText("Nenhum pet cadastrado")).toBeInTheDocument();
  });

  it("desativa o tutor após confirmar", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    let deletado = false;
    server.use(
      http.get(`${BASE}/tutores/1/`, () => HttpResponse.json(TUTOR)),
      http.get(`${BASE}/pets/`, () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
      http.delete(`${BASE}/tutores/1/`, () => {
        deletado = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    montar();
    await userEvent.click(await screen.findByRole("button", { name: "Desativar" }));

    await waitFor(() => expect(deletado).toBe(true));
  });

  it("não desativa se o usuário cancelar a confirmação", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    let deletado = false;
    server.use(
      http.get(`${BASE}/tutores/1/`, () => HttpResponse.json(TUTOR)),
      http.get(`${BASE}/pets/`, () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
      http.delete(`${BASE}/tutores/1/`, () => {
        deletado = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    montar();
    await userEvent.click(await screen.findByRole("button", { name: "Desativar" }));

    expect(deletado).toBe(false);
  });
});
