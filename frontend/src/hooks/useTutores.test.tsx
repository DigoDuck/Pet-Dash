import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { useTutores } from "./useTutores";

const BASE = "http://localhost:8000/api";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useTutores", () => {
  it("busca a lista paginada e envia search e page", async () => {
    let urlChamada = "";
    server.use(
      http.get(`${BASE}/tutores/`, ({ request }) => {
        urlChamada = request.url;
        return HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [
            { id: 1, nome: "Ana", telefone: "71", email: "", ativo: true, created_at: "2026-07-01" },
          ],
        });
      }),
    );

    const { result } = renderHook(() => useTutores("Ana", 2), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.results[0].nome).toBe("Ana");
    expect(urlChamada).toContain("search=Ana");
    expect(urlChamada).toContain("page=2");
  });
});
