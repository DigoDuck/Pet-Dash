import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
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

// Nome diferente do tutor da tabela de propósito: os destaques ficam na mesma página
// que a lista, e um nome repetido tornaria as buscas por texto ambíguas.
const PET_VIP = {
  id: 7,
  tutor: 3,
  tutor_nome: "Camila Souza",
  nome: "Luna",
  raca: "SRD",
  porte: "M",
  ativo: true,
  created_at: "2026-01-01",
  vip: true,
  qtd_visitas: 4,
  total_gasto: "600.00",
};

const DESTAQUES = {
  faturamento: "8000.00",
  custos: "1500.00",
  retiradas: "2000.00",
  lucro: "6500.00",
  ticket_medio: "80.00",
  margem: "0.8125",
  qtd_atendimentos: 12,
  pets_ativos: 3,
  vip: [PET_VIP],
  top_tutores: [{ id: 3, nome: "Camila Souza", gasto_total: "600.00" }],
  custos_por_categoria: [],
};

// A página passou a consumir /dashboard/ para os Destaques do mês. Sem handler, o MSW
// está em onUnhandledRequest: "error" e derrubaria todos os testes desta suíte.
beforeEach(() => {
  server.use(http.get(`${BASE}/dashboard/`, () => HttpResponse.json(DESTAQUES)));
});

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

  // Migrados do Dashboard. Top tutores por gasto é a mitigação do ponto cego do VIP
  // por pet (invariante 6): sem ele, tutor com vários pets abaixo do limite some.
  it("mostra os destaques do mês: top tutores e pets VIP", async () => {
    server.use(http.get(`${BASE}/tutores/`, () => HttpResponse.json(paginado([tutor(3, "Ana Clara")]))));

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });

    expect(await screen.findByText("Top tutores do mês")).toBeInTheDocument();
    expect(screen.getByText("Pets VIP")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Luna" })).toHaveAttribute("href", "/pets/7");
    expect(screen.getByRole("link", { name: "Camila Souza" })).toHaveAttribute("href", "/clientes/3");
    expect(screen.getByText("4 visitas")).toBeInTheDocument();
  });

  it("erro nos destaques não derruba a tabela de clientes", async () => {
    server.use(
      http.get(`${BASE}/tutores/`, () => HttpResponse.json(paginado([tutor(1, "Ana Clara")]))),
      http.get(`${BASE}/dashboard/`, () => new HttpResponse(null, { status: 500 })),
    );

    renderizarComProvedores(<Clientes />, { rota: "/clientes", caminho: "/clientes" });

    expect(await screen.findByText("Não foi possível carregar os pets VIP.")).toBeInTheDocument();
    expect(screen.getByText("Ana Clara")).toBeInTheDocument();
  });
});
