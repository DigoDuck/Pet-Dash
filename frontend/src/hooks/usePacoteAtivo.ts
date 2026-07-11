import { useQuery } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Pacote } from "../lib/types";

export function usePacoteAtivo(petId: number | null) {
  return useQuery({
    queryKey: ["pacote-ativo", petId],
    // request<T> devolve null no 204 (pet sem pacote no mês) — o tipo reflete isso.
    queryFn: () => request<Pacote | null>(`/pets/${petId}/pacote-ativo/`),
    enabled: petId != null && petId > 0,
  });
}
