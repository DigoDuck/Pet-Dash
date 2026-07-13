import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "../test/msw/server";
import { useCriarCusto, useCustos, useExcluirCusto } from "./useCustos";
import { useRetiradas } from "./useRetiradas";

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

const CUSTO = {
  tipo: "fixo" as const,
  descricao: "Aluguel",
  valor: "1200.00",
  categoria: "Estrutura",
  competencia: "2026-07-01",
};

describe("useCustos", () => {
  it("manda competência, tipo e página na query", async () => {
    let url = "";
    server.use(
      http.get(`${BASE}/custos/`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] });
      }),
    );
    const { wrapper } = ambiente();

    const { result } = renderHook(() => useCustos("2026-07-01", "fixo", 2), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(url).toContain("competencia=2026-07-01");
    expect(url).toContain("tipo=fixo");
    expect(url).toContain("page=2");
  });

  it("omite o tipo quando o filtro é 'todos'", async () => {
    let url = "";
    server.use(
      http.get(`${BASE}/custos/`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] });
      }),
    );
    const { wrapper } = ambiente();

    const { result } = renderHook(() => useCustos("2026-07-01", "", 1), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(url).not.toContain("tipo=");
  });

  // O teste que protege o número na tela: sem invalidar o dashboard, o card
  // "Custos do mês" continua no valor velho depois do lançamento.
  it("ao criar, invalida também a chave dashboard", async () => {
    server.use(http.post(`${BASE}/custos/`, () => HttpResponse.json({ id: 1 }, { status: 201 })));
    const { client, wrapper } = ambiente();
    const invalidar = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCriarCusto(), { wrapper });
    result.current.mutate(CUSTO);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });

  it("ao excluir, invalida também a chave dashboard", async () => {
    server.use(http.delete(`${BASE}/custos/1/`, () => new HttpResponse(null, { status: 204 })));
    const { client, wrapper } = ambiente();
    const invalidar = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useExcluirCusto(), { wrapper });
    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });
});

describe("useRetiradas", () => {
  it("filtra o mês por intervalo de data, não por competência", async () => {
    let url = "";
    server.use(
      http.get(`${BASE}/retiradas/`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] });
      }),
    );
    const { wrapper } = ambiente();

    const { result } = renderHook(() => useRetiradas("2026-07-01", "2026-07-31", 1), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(url).toContain("data__gte=2026-07-01");
    expect(url).toContain("data__lte=2026-07-31");
  });
});
