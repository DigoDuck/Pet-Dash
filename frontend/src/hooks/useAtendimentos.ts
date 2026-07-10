import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Atendimento, Paginated } from "../lib/types";

export const chavesAtendimentos = {
  raiz: ["atendimentos"] as const,
  doPet: (petId: number, pagina: number) => ["atendimentos", "doPet", petId, pagina] as const,
};

export function useAtendimentosDoPet(petId: number, pagina: number) {
  return useQuery({
    queryKey: chavesAtendimentos.doPet(petId, pagina),
    queryFn: () =>
      request<Paginated<Atendimento>>(`/atendimentos/?pet=${petId}&page=${pagina}`),
    placeholderData: keepPreviousData,
  });
}
