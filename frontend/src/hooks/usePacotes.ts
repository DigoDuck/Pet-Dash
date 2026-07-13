import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Pacote, PacoteEntrada, Paginated } from "../lib/types";

export const chavesPacotes = {
  raiz: ["pacotes"] as const,
  lista: (competencia: string, busca: string, pagina: number) =>
    ["pacotes", "lista", competencia, busca, pagina] as const,
};

// Invalida a lista E o pacote-ativo. Sem a segunda chave, o AtendimentoForm
// serviria cache velho logo após a venda, o atendimento nasceria avulso e o
// dinheiro do pacote entraria duas vezes no faturamento (invariantes 1 e 2).
function invalidarPacotes(client: QueryClient) {
  client.invalidateQueries({ queryKey: chavesPacotes.raiz });
  client.invalidateQueries({ queryKey: ["pacote-ativo"] });
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

export function useAtualizarPacote(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: Partial<PacoteEntrada>) =>
      request<Pacote>(`/pacotes/${id}/`, { method: "PATCH", body: JSON.stringify(dados) }),
    onSuccess: () => invalidarPacotes(client),
  });
}
