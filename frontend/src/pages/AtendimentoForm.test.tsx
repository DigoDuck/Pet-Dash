import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { renderizarComProvedores } from "../test/utils";
import { server } from "../test/msw/server";
import { AtendimentoForm } from "./AtendimentoForm";

const BASE = "http://localhost:8000/api";

function servicosOk() {
  return http.get(`${BASE}/servicos/`, () =>
    HttpResponse.json({
      count: 1, next: null, previous: null,
      results: [{ id: 1, nome: "Banho", preco_padrao: "60.00", is_pacote: false, creditos: null, ativo: true }],
    }),
  );
}

function petsOk() {
  return http.get(`${BASE}/pets/`, () =>
    HttpResponse.json({
      count: 1, next: null, previous: null,
      results: [{
        id: 7, tutor: 1, tutor_nome: "Ana Clara", nome: "Luna", raca: "", porte: "",
        ativo: true, created_at: "", vip: false, qtd_visitas: 0, total_gasto: "0.00",
      }],
    }),
  );
}

async function escolherLuna() {
  await userEvent.type(screen.getByLabelText("Pet"), "Luna");
  await waitFor(() => expect(screen.getByText("Luna · Ana Clara")).toBeInTheDocument());
  await userEvent.click(screen.getByText("Luna · Ana Clara"));
}

describe("AtendimentoForm", () => {
  it("escolher serviço pré-preenche o valor com o preço de referência", async () => {
    server.use(servicosOk(), petsOk());

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });

    // Esperar a option carregar via MSW antes de selecionar (senão "value not found").
    await screen.findByRole("option", { name: "Banho" });
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "1");

    await waitFor(() => expect(screen.getByLabelText("Valor")).toHaveValue("60.00"));
  });

  it("pet com pacote vincula e esconde os pagamentos", async () => {
    server.use(
      servicosOk(),
      petsOk(),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () =>
        HttpResponse.json({
          id: 3, pet: 7, servico: 1, competencia: "2026-07-01", qtd_total: 4,
          valor_pago: "220.00", data_compra: "2026-07-01", validade: "2026-07-31", saldo: 3,
        }),
      ),
    );

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await escolherLuna();

    expect(await screen.findByText("Pacote Fidelidade vinculado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar pagamento" })).not.toBeInTheDocument();
  });

  it("'cobrar como avulso' desvincula e revela os pagamentos", async () => {
    server.use(
      servicosOk(),
      petsOk(),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () =>
        HttpResponse.json({
          id: 3, pet: 7, servico: 1, competencia: "2026-07-01", qtd_total: 4,
          valor_pago: "220.00", data_compra: "2026-07-01", validade: "2026-07-31", saldo: 3,
        }),
      ),
    );

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await escolherLuna();
    await screen.findByText("Pacote Fidelidade vinculado");

    await userEvent.click(screen.getByRole("button", { name: "Cobrar como avulso" }));

    expect(screen.getByRole("button", { name: "Adicionar pagamento" })).toBeInTheDocument();
    expect(screen.queryByText("Pacote Fidelidade vinculado")).not.toBeInTheDocument();
  });

  it("pet com pacote saldo 0 cai em avulso com aviso", async () => {
    server.use(
      servicosOk(),
      petsOk(),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () =>
        HttpResponse.json({
          id: 3, pet: 7, servico: 1, competencia: "2026-07-01", qtd_total: 4,
          valor_pago: "220.00", data_compra: "2026-07-01", validade: "2026-07-31", saldo: 0,
        }),
      ),
    );

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await escolherLuna();

    expect(await screen.findByText(/sem saldo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar pagamento" })).toBeInTheDocument();
  });
});
