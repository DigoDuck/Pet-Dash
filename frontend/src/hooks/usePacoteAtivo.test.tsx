import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { usePacoteAtivo } from "./usePacoteAtivo";

const BASE = "http://localhost:8000/api";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("usePacoteAtivo", () => {
  it("devolve o pacote quando existe", async () => {
    server.use(
      http.get(`${BASE}/pets/7/pacote-ativo/`, () =>
        HttpResponse.json({
          id: 3, pet: 7, servico: 1, competencia: "2026-07-01", qtd_total: 4,
          valor_pago: "220.00", data_compra: "2026-07-01", validade: "2026-07-31", saldo: 3,
        }),
      ),
    );

    const { result } = renderHook(() => usePacoteAtivo(7), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.saldo).toBe(3);
  });

  it("devolve null quando a API responde 204", async () => {
    server.use(
      http.get(`${BASE}/pets/8/pacote-ativo/`, () => new HttpResponse(null, { status: 204 })),
    );

    const { result } = renderHook(() => usePacoteAtivo(8), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("não busca quando petId é null", () => {
    const { result } = renderHook(() => usePacoteAtivo(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });
});
