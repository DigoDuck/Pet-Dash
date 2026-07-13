import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../test/msw/server";
import { PacoteForm } from "./PacoteForm";

const BASE = "http://localhost:8000/api";

function paginado(results: unknown[]) {
  return { count: results.length, next: null, previous: null, results };
}

function renderizar(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// toFake: ["Date"] falsifica SÓ o relógio. O setTimeout continua real, então o
// debounce de 300ms da busca de pet se comporta como nos testes do PR 12 (que
// passam sem fake timers). Falsificar os timers inteiros trava o userEvent.
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

// Mesmo passo a passo do AtendimentoForm.test: esperar a option aparecer via
// MSW antes de clicar, senão o combobox ainda está vazio.
async function escolherLuna() {
  await userEvent.type(screen.getByLabelText("Pet"), "Luna");
  await waitFor(() => expect(screen.getByText("Luna · Ana")).toBeInTheDocument());
  await userEvent.click(screen.getByText("Luna · Ana"));
}

describe("PacoteForm", () => {
  it("escolher o serviço sugere valor e créditos do catálogo", async () => {
    renderizar(<PacoteForm aoSalvar={vi.fn()} enviando={false} aoCancelar={vi.fn()} />);

    // Sem esperar a option carregar, selectOptions estoura com "value not found".
    await screen.findByRole("option", { name: "Pacote Fidelidade" });
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "5");

    await waitFor(() => expect(screen.getByLabelText("Valor pago")).toHaveValue("220.00"));
    expect(screen.getByLabelText("Créditos")).toHaveValue(4);
  });

  it("mudar a competência recalcula a validade para o último dia do mês", async () => {
    renderizar(<PacoteForm aoSalvar={vi.fn()} enviando={false} aoCancelar={vi.fn()} />);

    const mes = await screen.findByLabelText("Competência");
    expect(screen.getByLabelText("Validade")).toHaveValue("2026-07-31");

    await userEvent.clear(mes);
    await userEvent.type(mes, "2026-02");

    await waitFor(() => expect(screen.getByLabelText("Validade")).toHaveValue("2026-02-28"));
  });

  it("envia a competência como dia 1 e os números convertidos", async () => {
    const aoSalvar = vi.fn();
    renderizar(<PacoteForm aoSalvar={aoSalvar} enviando={false} aoCancelar={vi.fn()} />);

    await screen.findByRole("option", { name: "Pacote Fidelidade" });
    await escolherLuna();
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "5");
    await waitFor(() => expect(screen.getByLabelText("Valor pago")).toHaveValue("220.00"));

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(aoSalvar).toHaveBeenCalledWith({
        pet: 7,
        servico: 5,
        competencia: "2026-07-01",
        qtd_total: 4,
        valor_pago: "220.00",
        data_compra: "2026-07-13",
        validade: "2026-07-31",
      }),
    );
  });

  it("sem pet escolhido, não envia e mostra o erro", async () => {
    const aoSalvar = vi.fn();
    renderizar(<PacoteForm aoSalvar={aoSalvar} enviando={false} aoCancelar={vi.fn()} />);

    await screen.findByRole("option", { name: "Pacote Fidelidade" });
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Escolha um pet")).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it("na edição, o valor salvo não é sobrescrito pelo preço do catálogo", async () => {
    renderizar(
      <PacoteForm
        inicial={{
          id: 1, pet: 7, pet_nome: "Luna", tutor_nome: "Ana", servico: 5,
          servico_nome: "Pacote Fidelidade", competencia: "2026-07-01", qtd_total: 4,
          valor_pago: "180.00", data_compra: "2026-07-02", validade: "2026-07-31", saldo: 3,
        }}
        aoSalvar={vi.fn()}
        enviando={false}
        aoCancelar={vi.fn()}
      />,
    );

    // 180.00 é o preço realmente cobrado (invariante 7). O catálogo diz 220.00
    // e não pode vencer.
    expect(await screen.findByLabelText("Valor pago")).toHaveValue("180.00");
    expect(screen.getByLabelText("Competência")).toBeDisabled();
  });

  it("exibe a mensagem de erro vinda da API", async () => {
    renderizar(
      <PacoteForm
        aoSalvar={vi.fn()}
        enviando={false}
        erro="Já existe um pacote para este pet nesta competência."
        aoCancelar={vi.fn()}
      />,
    );

    expect(
      await screen.findByText("Já existe um pacote para este pet nesta competência."),
    ).toBeInTheDocument();
  });
});
