import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Paginated, Retirada, RetiradaEntrada } from "../lib/types";
import { invalidarFinanceiro } from "./useCustos";

export const chavesRetiradas = {
  raiz: ["retiradas"] as const,
  lista: (inicio: string, fim: string, pagina: number) =>
    ["retiradas", "lista", inicio, fim, pagina] as const,
};

// Retirada tem data real (não competência), então o mês vira um intervalo. Os dois
// filtros precisam ir juntos: só `data__gte` traria também os meses seguintes.
export function useRetiradas(inicio: string, fim: string, pagina: number) {
  const params = new URLSearchParams({ page: String(pagina) });
  params.set("data__gte", inicio);
  params.set("data__lte", fim);
  return useQuery({
    queryKey: chavesRetiradas.lista(inicio, fim, pagina),
    queryFn: () => request<Paginated<Retirada>>(`/retiradas/?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useCriarRetirada() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: RetiradaEntrada) =>
      request<Retirada>("/retiradas/", { method: "POST", body: JSON.stringify(dados) }),
    onSuccess: () => invalidarFinanceiro(client, chavesRetiradas.raiz),
  });
}

export function useAtualizarRetirada(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: RetiradaEntrada) =>
      request<Retirada>(`/retiradas/${id}/`, { method: "PUT", body: JSON.stringify(dados) }),
    onSuccess: () => invalidarFinanceiro(client, chavesRetiradas.raiz),
  });
}

export function useExcluirRetirada() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request<null>(`/retiradas/${id}/`, { method: "DELETE" }),
    onSuccess: () => invalidarFinanceiro(client, chavesRetiradas.raiz),
  });
}
