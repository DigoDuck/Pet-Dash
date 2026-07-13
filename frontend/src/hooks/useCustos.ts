import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Custo, CustoEntrada, Paginated, TipoCusto } from "../lib/types";
import { chavesDashboard } from "./useDashboard";

export const chavesCustos = {
  raiz: ["custos"] as const,
  lista: (competencia: string, tipo: string, pagina: number) =>
    ["custos", "lista", competencia, tipo, pagina] as const,
};

// Invalida a lista E o dashboard. Sem a segunda chave, lançar um custo de R$ 300
// atualizaria a tabela e deixaria o card "Custos do mês" no valor antigo — a tela
// se contradiz na mesma dobra. O total é derivado no backend (invariante 9), então
// a única forma de atualizá-lo é refazer a query.
export function invalidarFinanceiro(client: QueryClient, chaveDaLista: readonly string[]) {
  client.invalidateQueries({ queryKey: chaveDaLista });
  client.invalidateQueries({ queryKey: chavesDashboard.raiz });
}

export function useCustos(competencia: string, tipo: TipoCusto | "", pagina: number) {
  const params = new URLSearchParams({ page: String(pagina) });
  if (competencia) params.set("competencia", competencia);
  if (tipo) params.set("tipo", tipo);
  return useQuery({
    queryKey: chavesCustos.lista(competencia, tipo, pagina),
    queryFn: () => request<Paginated<Custo>>(`/custos/?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useCriarCusto() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: CustoEntrada) =>
      request<Custo>("/custos/", { method: "POST", body: JSON.stringify(dados) }),
    onSuccess: () => invalidarFinanceiro(client, chavesCustos.raiz),
  });
}

export function useAtualizarCusto(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: CustoEntrada) =>
      request<Custo>(`/custos/${id}/`, { method: "PUT", body: JSON.stringify(dados) }),
    onSuccess: () => invalidarFinanceiro(client, chavesCustos.raiz),
  });
}

// Hard-delete: Custo não tem soft-delete (a invariante 11 cobre só Tutor e Pet) e
// nenhuma FK aponta para ele, então não há ProtectedError a tratar. A linha some e
// o fechamento daquele mês muda — por isso a UI confirma antes.
export function useExcluirCusto() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request<null>(`/custos/${id}/`, { method: "DELETE" }),
    onSuccess: () => invalidarFinanceiro(client, chavesCustos.raiz),
  });
}
