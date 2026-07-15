import type { Atendimento } from "../lib/types";

/** Fixture de Atendimento para testes. Vivia copiada em três arquivos de teste;
 *  cada campo novo no type exigia varrer todas as cópias (o `pet_vip` exigiu duas
 *  edições no mesmo PR). O que importar para o teste, sobrescreva via `over`. */
export function atendimento(over: Partial<Atendimento> = {}): Atendimento {
  return {
    id: 1, pet: 7, pet_nome: "Luna", tutor_nome: "Ana Clara", pet_vip: false,
    servico: 1, servico_nome: "Banho", pacote: null,
    data: "2026-07-15", horario: "10:00:00", valor: "65.00",
    transporte: false, transporte_valor: "0.00", manejo_especial: false,
    status: "Pendente", pagamentos: [],
    ...over,
  };
}
