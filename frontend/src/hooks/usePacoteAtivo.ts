import { useQuery } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Pacote } from "../lib/types";

/** Pacote do pet na competência do atendimento — não a de hoje.
 *
 *  Sem a competência, lançar em 1º de julho o banho de 30 de junho consultava o pacote
 *  de julho: ou o banho nascia avulso (e o dinheiro de junho era faturado duas vezes,
 *  quebrando a invariante 1) ou consumia crédito do mês errado. A Patricia lança com
 *  atraso — é o caso normal de quem vem de planilha, não a exceção.
 *
 *  @param competencia "2026-06-01". Vazio usa o mês corrente (default do backend). */
export function usePacoteAtivo(petId: number | null, competencia = "") {
  const query = competencia ? `?competencia=${competencia}` : "";
  return useQuery({
    queryKey: ["pacote-ativo", petId, competencia],
    // request<T> devolve null no 204 (pet sem pacote no mês) — o tipo reflete isso.
    queryFn: () => request<Pacote | null>(`/pets/${petId}/pacote-ativo/${query}`),
    enabled: petId != null && petId > 0,
  });
}
