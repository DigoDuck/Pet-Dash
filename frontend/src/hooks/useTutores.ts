import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Paginated, Tutor } from "../lib/types";

export type TutorEntrada = Pick<Tutor, "nome" | "telefone" | "email">;

export const chavesTutores = {
  raiz: ["tutores"] as const,
  lista: (busca: string, pagina: number) => ["tutores", "lista", busca, pagina] as const,
  detalhe: (id: number) => ["tutores", "detalhe", id] as const,
};

export function useTutores(busca: string, pagina: number) {
  const params = new URLSearchParams({ page: String(pagina) });
  if (busca) params.set("search", busca);
  return useQuery({
    queryKey: chavesTutores.lista(busca, pagina),
    queryFn: () => request<Paginated<Tutor>>(`/tutores/?${params}`),
    // Sem isto a lista pisca em branco a cada tecla digitada na busca.
    placeholderData: keepPreviousData,
  });
}

export function useTutor(id: number) {
  return useQuery({
    queryKey: chavesTutores.detalhe(id),
    queryFn: () => request<Tutor>(`/tutores/${id}/`),
  });
}

export function useCriarTutor() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: TutorEntrada) =>
      request<Tutor>("/tutores/", { method: "POST", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesTutores.raiz }),
  });
}

export function useAtualizarTutor(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: TutorEntrada) =>
      request<Tutor>(`/tutores/${id}/`, { method: "PATCH", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesTutores.raiz }),
  });
}

/** DELETE no backend é soft-delete (ativo = False); o histórico financeiro fica. */
export function useDesativarTutor() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request<null>(`/tutores/${id}/`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesTutores.raiz }),
  });
}
