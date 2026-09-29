import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Paginated, Servico, ServicoEntrada } from "../lib/types";

export const chavesServicos = {
  raiz: ["servicos"] as const,
  lista: (busca: string, incluirInativos: boolean, pagina: number) =>
    ["servicos", "lista", busca, incluirInativos, pagina] as const,
};

/** A página não era repassada: a tela desenhava a Paginacao, mas "Próxima" pedia sempre
 *  a primeira página e nada mudava. `pagina` padrão 1 mantém o select do atendimento
 *  como estava (o catálogo cabe numa página de 50). */
export function useServicos(busca: string, incluirInativos: boolean, pagina = 1) {
  const params = new URLSearchParams({ page: String(pagina) });
  if (busca) params.set("search", busca);
  // Sem o toggle, a lista mostra só ativos. Ligado, omite o filtro (vêm todos).
  if (!incluirInativos) params.set("ativo", "true");
  return useQuery({
    queryKey: chavesServicos.lista(busca, incluirInativos, pagina),
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

// Só os serviços que são pacote, para o Select da venda. A chave começa com
// "servicos", então as mutations de serviço já invalidam esta query também.
export function useServicosPacote() {
  return useQuery({
    queryKey: ["servicos", "pacotes"] as const,
    queryFn: () => request<Paginated<Servico>>("/servicos/?is_pacote=true&ativo=true"),
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
