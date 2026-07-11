import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Atendimento, AtendimentoEntrada, Paginated } from "../lib/types";

export interface FiltrosAtendimento {
  data: string;
  status: string;
  pet: number | null;
  pagina: number;
}

export const chavesAtendimentos = {
  raiz: ["atendimentos"] as const,
  doPet: (petId: number, pagina: number) => ["atendimentos", "doPet", petId, pagina] as const,
  lista: (f: FiltrosAtendimento) =>
    ["atendimentos", "lista", f.data, f.status, f.pet, f.pagina] as const,
  detalhe: (id: number) => ["atendimentos", "detalhe", id] as const,
};

export function useAtendimentosDoPet(petId: number, pagina: number) {
  return useQuery({
    queryKey: chavesAtendimentos.doPet(petId, pagina),
    queryFn: () =>
      request<Paginated<Atendimento>>(`/atendimentos/?pet=${petId}&page=${pagina}`),
    placeholderData: keepPreviousData,
  });
}

export function useAtendimentos(filtros: FiltrosAtendimento) {
  const params = new URLSearchParams({ page: String(filtros.pagina) });
  if (filtros.data) params.set("data", filtros.data);
  if (filtros.status) params.set("status", filtros.status);
  if (filtros.pet != null) params.set("pet", String(filtros.pet));
  return useQuery({
    queryKey: chavesAtendimentos.lista(filtros),
    queryFn: () => request<Paginated<Atendimento>>(`/atendimentos/?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useAtendimento(id: number) {
  return useQuery({
    queryKey: chavesAtendimentos.detalhe(id),
    queryFn: () => request<Atendimento>(`/atendimentos/${id}/`),
    enabled: id > 0,
  });
}

export function useCriarAtendimento() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: AtendimentoEntrada) =>
      request<Atendimento>("/atendimentos/", { method: "POST", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesAtendimentos.raiz }),
  });
}

export function useAtualizarAtendimento(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: Partial<AtendimentoEntrada>) =>
      request<Atendimento>(`/atendimentos/${id}/`, { method: "PATCH", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesAtendimentos.raiz }),
  });
}
