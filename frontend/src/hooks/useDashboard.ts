import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { ResumoFinanceiro } from "../lib/types";

export const chavesDashboard = {
  raiz: ["dashboard"] as const,
  periodo: (inicio: string, fim: string) => ["dashboard", inicio, fim] as const,
};

/** KPIs do período, agregados no backend (invariante 9: financeiro é derivado em
 *  query, nunca somado no cliente nem materializado). A página Financeiro usa
 *  `custos` e `retiradas`; o dashboard do PR 15 usa a resposta inteira. */
export function useDashboard(inicio: string, fim: string) {
  return useQuery({
    queryKey: chavesDashboard.periodo(inicio, fim),
    queryFn: () => request<ResumoFinanceiro>(`/dashboard/?inicio=${inicio}&fim=${fim}`),
    placeholderData: keepPreviousData,
  });
}
