import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "../test/msw/server";
import { useAtualizarAtendimento, useCriarAtendimento } from "./useAtendimentos";
import { useCriarPacote } from "./usePacotes";

const BASE = "http://localhost:8000/api";

function ambiente() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

const ATENDIMENTO = {
  pet: 1,
  servico: 1,
  pacote: null,
  data: "2026-07-13",
  horario: "10:00",
  valor: "95.00",
  transporte: false,
  transporte_valor: "0.00",
  manejo_especial: false,
  status: "Liberado" as const,
  pagamentos: [{ metodo: "Pix" as const, valor: "95.00" }],
};

const PACOTE = {
  pet: 1,
  servico: 2,
  competencia: "2026-07-01",
  qtd_total: 4,
  valor_pago: "220.00",
  data_compra: "2026-07-01",
  validade: "2026-07-31",
};

// Estes três testes protegem um bug que existia de verdade: atendimento e pacote
// mudam o faturamento, mas as mutações deles só invalidavam as próprias listas. Na
// prática, liberar um atendimento deixava o KPI, o gráfico e o feed no valor antigo
// até um F5 — sem erro, sem log, só um número errado numa tela de dinheiro.
describe("invalidação do dashboard nas mutações que mexem em dinheiro", () => {
  it("criar atendimento invalida a raiz dashboard", async () => {
    server.use(
      http.post(`${BASE}/atendimentos/`, () => HttpResponse.json({ id: 1 }, { status: 201 })),
    );
    const { client, wrapper } = ambiente();
    const invalidar = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCriarAtendimento(), { wrapper });
    result.current.mutate(ATENDIMENTO);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });

  // O caso mais caro: mudar Pendente -> Liberado passa por aqui, e é o que faz o
  // dinheiro entrar no faturamento.
  it("atualizar atendimento (liberar) invalida a raiz dashboard", async () => {
    server.use(
      http.patch(`${BASE}/atendimentos/1/`, () => HttpResponse.json({ id: 1 })),
    );
    const { client, wrapper } = ambiente();
    const invalidar = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useAtualizarAtendimento(1), { wrapper });
    result.current.mutate({ status: "Liberado" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });

  it("vender pacote invalida a raiz dashboard", async () => {
    server.use(http.post(`${BASE}/pacotes/`, () => HttpResponse.json({ id: 1 }, { status: 201 })));
    const { client, wrapper } = ambiente();
    const invalidar = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCriarPacote(), { wrapper });
    result.current.mutate(PACOTE);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });
});
