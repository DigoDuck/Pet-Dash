import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { useServicos } from "./useServicos";

const BASE = "http://localhost:8000/api";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useServicos", () => {
  it("filtra por ativo quando não inclui inativos", async () => {
    let url = "";
    server.use(
      http.get(`${BASE}/servicos/`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] });
      }),
    );

    const { result } = renderHook(() => useServicos("", false), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(url).toContain("ativo=true");
  });

  it("omite o filtro ativo quando inclui inativos e envia a busca", async () => {
    let url = "";
    server.use(
      http.get(`${BASE}/servicos/`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] });
      }),
    );

    const { result } = renderHook(() => useServicos("Banho", true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(url).not.toContain("ativo=");
    expect(url).toContain("search=Banho");
  });
});
