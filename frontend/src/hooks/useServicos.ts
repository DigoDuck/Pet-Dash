import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Paginated, Servico, ServicoEntrada } from "../lib/types";

export const chavesServicos = {
  raiz: ["servicos"] as const,
  lista: (busca: string, incluirInativos: boolean) =>
    ["servicos", "lista", busca, incluirInativos] as const,
};

export function useServicos(busca: string, incluirInativos: boolean) {
  const params = new URLSearchParams();
  if (busca) params.set("search", busca);
  // Sem o toggle, a lista mostra só ativos. Ligado, omite o filtro (vêm todos).
  if (!incluirInativos) params.set("ativo", "true");
  return useQuery({
    queryKey: chavesServicos.lista(busca, incluirInativos),
    queryFn: () => request<Paginated<Servico>>(`/servicos/?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useCriarServico() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: ServicoEntrada) =>
      request<Servico>("/servicos/", { method: "POST", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesServicos.raiz }),
  });
}

// PATCH parcial cobre os três casos: editar (objeto do form), desativar
// ({ativo:false}) e reativar ({ativo:true}).
export function useAtualizarServico(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: Partial<Servico>) =>
      request<Servico>(`/servicos/${id}/`, { method: "PATCH", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesServicos.raiz }),
  });
}
