import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Paginated, Pet, Porte } from "../lib/types";

export interface PetEntrada {
  tutor: number;
  nome: string;
  raca: string;
  porte: Porte;
  agressivo: boolean;
  otite: boolean;
  problema_pele: boolean;
}

export const chavesPets = {
  raiz: ["pets"] as const,
  lista: (busca: string, pagina: number) => ["pets", "lista", busca, pagina] as const,
  doTutor: (tutorId: number) => ["pets", "doTutor", tutorId] as const,
  detalhe: (id: number) => ["pets", "detalhe", id] as const,
};

export function usePetsDoTutor(tutorId: number) {
  return useQuery({
    queryKey: chavesPets.doTutor(tutorId),
    queryFn: () => request<Paginated<Pet>>(`/pets/?tutor=${tutorId}`),
  });
}

/** Listagem paginada da aba Pets. Não dá para reusar o `useBuscaPets`: ele tem
 *  `enabled: termo.length > 0` e devolveria lista vazia com a busca em branco, que é
 *  justamente o estado inicial da aba. */
export function usePets(busca: string, pagina: number, ativo = true) {
  const params = new URLSearchParams({ page: String(pagina) });
  if (busca) params.set("search", busca);
  return useQuery({
    queryKey: chavesPets.lista(busca, pagina),
    queryFn: () => request<Paginated<Pet>>(`/pets/?${params}`),
    enabled: ativo,
    placeholderData: keepPreviousData,
  });
}

export function usePet(id: number) {
  return useQuery({
    queryKey: chavesPets.detalhe(id),
    queryFn: () => request<Pet>(`/pets/${id}/`),
  });
}

export function useCriarPet() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: PetEntrada) =>
      request<Pet>("/pets/", { method: "POST", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesPets.raiz }),
  });
}

export function useAtualizarPet(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: PetEntrada) =>
      request<Pet>(`/pets/${id}/`, { method: "PATCH", body: JSON.stringify(dados) }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesPets.raiz }),
  });
}

export function useDesativarPet() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request<null>(`/pets/${id}/`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: chavesPets.raiz }),
  });
}

export function useBuscaPets(termo: string) {
  return useQuery({
    queryKey: ["pets", "busca", termo],
    queryFn: () => request<Paginated<Pet>>(`/pets/?search=${encodeURIComponent(termo)}`),
    enabled: termo.length > 0,
    placeholderData: keepPreviousData,
  });
}
