export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Tutor {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  ativo: boolean;
  created_at: string;
}

export type Porte = "" | "P" | "M" | "G";

export interface Pet {
  id: number;
  tutor: number;
  tutor_nome: string;
  nome: string;
  raca: string;
  porte: Porte;
  ativo: boolean;
  created_at: string;
  vip: boolean;
  qtd_visitas: number;
  total_gasto: string;
}

export interface Pagamento {
  id: number;
  metodo: "Pix" | "Cartao" | "Dinheiro";
  valor: string;
}

export type StatusAtendimento = "Liberado" | "Pendente" | "Cancelado";

export interface Atendimento {
  id: number;
  pet: number;
  servico: number;
  servico_nome: string;
  pet_nome: string;
  tutor_nome: string;
  /** Não-nulo significa consumo de crédito de pacote (invariante 2). */
  pacote: number | null;
  data: string;
  horario: string;
  valor: string;
  transporte: boolean;
  transporte_valor: string;
  status: StatusAtendimento;
  pagamentos: Pagamento[];
}

export const PORTES: { valor: Porte; rotulo: string }[] = [
  { valor: "", rotulo: "Não informado" },
  { valor: "P", rotulo: "Pequeno" },
  { valor: "M", rotulo: "Médio" },
  { valor: "G", rotulo: "Grande" },
];

export const TAMANHO_PAGINA = 50;

export interface Servico {
  id: number;
  nome: string;
  preco_padrao: string;
  is_pacote: boolean;
  creditos: number | null;
  ativo: boolean;
}

export type ServicoEntrada = Pick<
  Servico,
  "nome" | "preco_padrao" | "is_pacote" | "creditos"
>;

export interface Pacote {
  id: number;
  pet: number;
  servico: number;
  competencia: string;
  qtd_total: number;
  valor_pago: string;
  data_compra: string;
  validade: string;
  saldo: number;
}

export interface PagamentoEntrada {
  metodo: "Pix" | "Cartao" | "Dinheiro";
  valor: string;
}

export interface AtendimentoEntrada {
  pet: number;
  servico: number;
  pacote: number | null;
  data: string;
  horario: string;
  valor: string;
  transporte: boolean;
  transporte_valor: string;
  status: StatusAtendimento;
  pagamentos: PagamentoEntrada[];
}
