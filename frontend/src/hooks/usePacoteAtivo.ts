import { useQuery } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Pacote } from "../lib/types";

/** Pacote do pet que vale na DATA do atendimento: a janela é a validade, não o mês.
 *
 *  Buscar pela competência exata fazia o banho de 05/10 de um pacote de setembro com
 *  validade estendida até 08/10 nascer avulso sem aviso (faturado em dobro, crédito
 *  perdido). A `competencia` vai junto só para a API antiga, que a Vercel pode estar
 *  servindo antes do Railway publicar; a API nova usa a `data` e ignora a competência.
 *
 *  @param data "2026-10-05". Vazio usa hoje (default do backend). */
export function usePacoteAtivo(petId: number | null, data = "") {
  const query = data ? `?data=${data}&competencia=${data.slice(0, 7)}-01` : "";
  return useQuery({
    queryKey: ["pacote-ativo", petId, data],
    // request<T> devolve null no 204 (pet sem pacote valendo na data) — o tipo reflete isso.
    queryFn: () => request<Pacote | null>(`/pets/${petId}/pacote-ativo/${query}`),
    enabled: petId != null && petId > 0,
  });
}
