import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Pacote, PacoteEntrada, Paginated } from "../lib/types";
import { invalidarDashboard } from "./useDashboard";

export const chavesPacotes = {
  raiz: ["pacotes"] as const,
  lista: (competencia: string, busca: string, pagina: number) =>
    ["pacotes", "lista", competencia, busca, pagina] as const,
};

// Invalida a lista, o pacote-ativo E o dashboard. Sem a segunda chave, o
// AtendimentoForm serviria cache velho logo após a venda, o atendimento nasceria
// avulso e o dinheiro do pacote entraria duas vezes no faturamento (invariantes 1 e
// 2). Sem a terceira, a venda (que É faturamento, pelo regime de caixa) não aparece
// nos KPIs nem no feed até um F5.
function invalidarPacotes(client: QueryClient) {
  client.invalidateQueries({ queryKey: chavesPacotes.raiz });
  client.invalidateQueries({ queryKey: ["pacote-ativo"] });
  invalidarDashboard(client);
}

export function usePacotes(competencia: string, busca: string, pagina: number) {
  const params = new URLSearchParams({ page: String(pagina) });
  if (competencia) params.set("competencia", competencia);
  if (busca) params.set("search", busca);
  return useQuery({
    queryKey: chavesPacotes.lista(competencia, busca, pagina),
    queryFn: () => request<Paginated<Pacote>>(`/pacotes/?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useCriarPacote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: PacoteEntrada) =>
      request<Pacote>("/pacotes/", { method: "POST", body: JSON.stringify(dados) }),
    onSuccess: () => invalidarPacotes(client),
  });
}

// Hard-delete, e o backend recusa com 400 quando há atendimento vinculado (o
// PROTECT conta o cancelado também). A venda É faturamento pelo regime de caixa,
// então a exclusão precisa invalidar o dashboard junto — daí o invalidarPacotes.
export function useExcluirPacote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request<null>(`/pacotes/${id}/`, { method: "DELETE" }),
    onSuccess: () => invalidarPacotes(client),
  });
}

export function useAtualizarPacote(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: Partial<PacoteEntrada>) =>
      request<Pacote>(`/pacotes/${id}/`, { method: "PATCH", body: JSON.stringify(dados) }),
    onSuccess: () => invalidarPacotes(client),
  });
}
