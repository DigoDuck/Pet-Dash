import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Atendimento, AtendimentoEntrada, Paginated } from "../lib/types";
import { invalidarDashboard } from "./useDashboard";

export interface FiltrosAtendimento {
  data: string;
  status: string;
  pet: number | null;
  pagina: number;
}

export const chavesAtendimentos = {
  raiz: ["atendimentos"] as const,
  doPet: (petId: number, pagina: number) => ["atendimentos", "doPet", petId, pagina] as const,
  lista: (f: FiltrosAtendimento) =>
    ["atendimentos", "lista", f.data, f.status, f.pet, f.pagina] as const,
  detalhe: (id: number) => ["atendimentos", "detalhe", id] as const,
};

export function useAtendimentosDoPet(petId: number, pagina: number) {
  return useQuery({
    queryKey: chavesAtendimentos.doPet(petId, pagina),
    queryFn: () =>
      request<Paginated<Atendimento>>(`/atendimentos/?pet=${petId}&page=${pagina}`),
    placeholderData: keepPreviousData,
  });
}

export function useAtendimentos(filtros: FiltrosAtendimento) {
  const params = new URLSearchParams({ page: String(filtros.pagina) });
  if (filtros.data) params.set("data", filtros.data);
  if (filtros.status) params.set("status", filtros.status);
  if (filtros.pet != null) params.set("pet", String(filtros.pet));
  return useQuery({
    queryKey: chavesAtendimentos.lista(filtros),
    queryFn: () => request<Paginated<Atendimento>>(`/atendimentos/?${params}`),
    placeholderData: keepPreviousData,
  });
}

/** Os atendimentos de um intervalo, para a agenda.
 *
 *  Chave sob a raiz `["atendimentos"]` de propósito: as mutações já invalidam essa raiz,
 *  então liberar ou cancelar um atendimento atualiza a grade de graça.
 *
 *  ponytail: sem paginação — a página vem com 50 e uma semana tem ~33 atendimentos
 *  (130/mês). Se uma semana passar de 50, a grade perde o excedente em silêncio; aí
 *  paginar aqui ou subir o PAGE_SIZE só desta rota. */
export function useAgenda(inicio: string, fim: string) {
  return useQuery({
    queryKey: ["atendimentos", "agenda", inicio, fim] as const,
    queryFn: () =>
      request<Paginated<Atendimento>>(
        // ordering=data,horario e não só horario: ordenar só pela hora embaralha os dias
        // entre si, e a tabela de próximos atendimentos sairia fora de ordem.
        `/atendimentos/?data__gte=${inicio}&data__lte=${fim}&ordering=data,horario`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAtendimento(id: number) {
  return useQuery({
    queryKey: chavesAtendimentos.detalhe(id),
    queryFn: () => request<Atendimento>(`/atendimentos/${id}/`),
    enabled: id > 0,
  });
}

// Um atendimento avulso Liberado É faturamento. Sem invalidar o dashboard, liberar
// um atendimento de R$ 95 atualiza a lista e deixa o faturamento, o gráfico e o feed
// no valor velho até um F5 — a tela contradiz a si mesma sem levantar erro nenhum.
//
// E o saldo do pacote é DERIVADO dos atendimentos (invariante 4): criar ou cancelar um
// consumo muda o saldo. Sem invalidar `pacote-ativo`, o próximo atendimento do mesmo pet
// consulta um saldo velho — e é o saldo que decide se o banho entra na cota ou vira
// avulso (faturando de novo o dinheiro do pacote).
function invalidarAtendimentos(client: QueryClient) {
  client.invalidateQueries({ queryKey: chavesAtendimentos.raiz });
  client.invalidateQueries({ queryKey: ["pacote-ativo"] });
  client.invalidateQueries({ queryKey: ["pacotes"] });
  invalidarDashboard(client);
}

export function useCriarAtendimento() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: AtendimentoEntrada) =>
      request<Atendimento>("/atendimentos/", { method: "POST", body: JSON.stringify(dados) }),
    onSuccess: () => invalidarAtendimentos(client),
  });
}

export function useAtualizarAtendimento(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dados: Partial<AtendimentoEntrada>) =>
      request<Atendimento>(`/atendimentos/${id}/`, { method: "PATCH", body: JSON.stringify(dados) }),
    onSuccess: () => invalidarAtendimentos(client),
  });
}
