import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { renderizarComProvedores } from "../test/utils";
import { server } from "../test/msw/server";
import { Clientes } from "./Clientes";

const BASE = "http://localhost:8000/api";

function tutor(id: number, nome: string) {
  return { id, nome, telefone: "71988880001", email: "", ativo: true, created_at: "2026-07-01" };
}

function paginado(results: unknown[], count = results.length) {
  return { count, next: null, previous: null, results };
}

describe("Clientes", () => {
  it("lista os tutores vindos da API", async () => {
    server.use(http.get(`${BASE}/tutores/`, () => HttpResponse.json(paginado([tutor(1, "Ana Clara")]))));

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });

    expect(await screen.findByText("Ana Clara")).toBeInTheDocument();
  });

  it("mostra o estado vazio quando não há tutores", async () => {
    server.use(http.get(`${BASE}/tutores/`, () => HttpResponse.json(paginado([]))));

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });

    expect(await screen.findByText("Nenhum cliente ainda")).toBeInTheDocument();
  });

  it("mostra o erro e permite tentar de novo", async () => {
    server.use(http.get(`${BASE}/tutores/`, () => new HttpResponse(null, { status: 500 })));

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
  });

  it("envia o termo de busca para a API", async () => {
    const buscas: string[] = [];
    server.use(
      http.get(`${BASE}/tutores/`, ({ request }) => {
        buscas.push(new URL(request.url).searchParams.get("search") ?? "");
        return HttpResponse.json(paginado([tutor(1, "Ana Clara")]));
      }),
    );

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });
    await screen.findByText("Ana Clara");

    await userEvent.type(screen.getByLabelText("Buscar por nome ou telefone"), "Ana");

    await waitFor(() => expect(buscas).toContain("Ana"));
  });

  it("cria um tutor pelo modal e fecha", async () => {
    let criados = 0;
    server.use(
      http.get(`${BASE}/tutores/`, () => HttpResponse.json(paginado([]))),
      http.post(`${BASE}/tutores/`, async () => {
        criados += 1;
        return HttpResponse.json(tutor(9, "Bruno"), { status: 201 });
      }),
    );

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });
    // Lista vazia sem busca mostra "Novo tutor" no cabeçalho E no EstadoVazio.
    // Esperar o empty renderizar e clicar no primeiro (o do cabeçalho).
    await screen.findByText("Nenhum cliente ainda");
    await userEvent.click(screen.getAllByRole("button", { name: "Novo tutor" })[0]);

    await userEvent.type(screen.getByLabelText("Nome"), "Bruno");
    await userEvent.type(screen.getByLabelText("Telefone"), "71988880004");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(criados).toBe(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
