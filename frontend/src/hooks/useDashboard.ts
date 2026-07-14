import { keepPreviousData, type QueryClient, useQuery } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { PontoSerie, ResumoFinanceiro, Transacao } from "../lib/types";

export const chavesDashboard = {
  raiz: ["dashboard"] as const,
  periodo: (inicio: string, fim: string) => ["dashboard", inicio, fim] as const,
  serie: (inicio: string, fim: string) => ["dashboard", "serie", inicio, fim] as const,
  transacoes: (inicio: string, fim: string) => ["dashboard", "transacoes", inicio, fim] as const,
};

/** Chamar em toda mutação que mexe em dinheiro: atendimento, pacote, custo, retirada.
 *
 *  A invalidação é por prefixo, então derrubar a raiz atualiza KPIs, gráfico e feed
 *  de uma vez. Sem isso, liberar um atendimento de R$ 95 deixa o faturamento na tela
 *  no valor antigo até um F5 — a tela contradiz a si mesma e ninguém vê erro nenhum. */
export function invalidarDashboard(client: QueryClient) {
  client.invalidateQueries({ queryKey: chavesDashboard.raiz });
}

/** KPIs do período, agregados no backend (invariante 9: financeiro é derivado em
 *  query, nunca somado no cliente nem materializado). A página Financeiro usa
 *  `custos` e `retiradas`; o Dashboard usa a resposta inteira. */
export function useDashboard(inicio: string, fim: string) {
  return useQuery({
    queryKey: chavesDashboard.periodo(inicio, fim),
    queryFn: () => request<ResumoFinanceiro>(`/dashboard/?inicio=${inicio}&fim=${fim}`),
    placeholderData: keepPreviousData,
  });
}

/** Um ponto por mês do intervalo, para o gráfico. Rota separada da dos KPIs porque
 *  a série custa 3 queries por mês: embutida no /dashboard/, a página Financeiro
 *  pagaria o gráfico inteiro só para mostrar dois totais.
 *
 *  A chave nasce sob a raiz `["dashboard"]` de propósito — as mutações de custo e
 *  retirada já invalidam essa raiz, então lançar um custo conserta o KPI e a barra
 *  do mesmo mês na mesma invalidação. Com chave própria fora da raiz, o gráfico
 *  ficaria velho e ninguém perceberia. */
export function useSerieMensal(inicio: string, fim: string) {
  return useQuery({
    queryKey: chavesDashboard.serie(inicio, fim),
    queryFn: () => request<PontoSerie[]>(`/dashboard/serie/?inicio=${inicio}&fim=${fim}`),
    placeholderData: keepPreviousData,
  });
}

/** Feed de caixa do período. O consumo de pacote não vem aqui, e não deve vir: o
 *  dinheiro dele entrou na venda (invariante 1). Quem filtra é o backend. */
export function useTransacoes(inicio: string, fim: string) {
  return useQuery({
    queryKey: chavesDashboard.transacoes(inicio, fim),
    queryFn: () => request<Transacao[]>(`/dashboard/transacoes/?inicio=${inicio}&fim=${fim}`),
    placeholderData: keepPreviousData,
  });
}
