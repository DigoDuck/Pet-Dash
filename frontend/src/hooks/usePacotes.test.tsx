import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "../test/msw/server";
import { useCriarPacote, usePacotes } from "./usePacotes";

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

describe("usePacotes", () => {
  it("manda competência, busca e página na query", async () => {
    let url = "";
    server.use(
      http.get(`${BASE}/pacotes/`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] });
      }),
    );
    const { wrapper } = ambiente();

    const { result } = renderHook(() => usePacotes("2026-07-01", "rex", 2), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(url).toContain("competencia=2026-07-01");
    expect(url).toContain("search=rex");
    expect(url).toContain("page=2");
  });

  it("ao vender, invalida também a chave pacote-ativo", async () => {
    server.use(
      http.post(`${BASE}/pacotes/`, () => HttpResponse.json({ id: 1 }, { status: 201 })),
    );
    const { client, wrapper } = ambiente();
    const invalidar = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCriarPacote(), { wrapper });
    result.current.mutate({
      pet: 1,
      servico: 2,
      competencia: "2026-07-01",
      qtd_total: 4,
      valor_pago: "220.00",
      data_compra: "2026-07-13",
      validade: "2026-07-31",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["pacote-ativo"] });
  });
});
