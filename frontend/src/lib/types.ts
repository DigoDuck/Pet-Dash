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
  /** Pet agressivo / contenção especial (+40%). Não recalcula `valor` no backend:
   *  `valor` é o snapshot do cobrado. Serve à sugestão de preço e à contagem. */
  manejo_especial: boolean;
  status: StatusAtendimento;
  pagamentos: Pagamento[];
}

/** A Patricia precifica por PESO. Os rótulos carregam a faixa dela para o porte não
 *  virar chute de quem cadastra — é ele que escolhe o preço sugerido no atendimento. */
export const PORTES: { valor: Porte; rotulo: string }[] = [
  { valor: "", rotulo: "Não informado" },
  { valor: "P", rotulo: "Pequeno (até 10 kg)" },
  { valor: "M", rotulo: "Médio (10 a 15 kg)" },
  { valor: "G", rotulo: "Grande (acima de 15 kg)" },
];

export const TAMANHO_PAGINA = 50;

export interface Servico {
  id: number;
  nome: string;
  /** Preço do pet pequeno (até 10 kg). Mantém o nome por compatibilidade, mas não é
   *  um preço "geral": é a faixa 1. Só sugestão de preenchimento (invariante 7). */
  preco_padrao: string;
  /** Médio (10 a 15 kg). Vazio cai no preço do pequeno. */
  preco_m: string | null;
  /** Grande (acima de 15 kg). Vazio cai no preço do pequeno. */
  preco_g: string | null;
  is_pacote: boolean;
  creditos: number | null;
  ativo: boolean;
}

export type ServicoEntrada = Pick<
  Servico,
  "nome" | "preco_padrao" | "preco_m" | "preco_g" | "is_pacote" | "creditos"
>;

/** Sugestão de preço para o porte do pet, caindo no preço do pequeno quando a faixa
 *  não tem preço próprio. Espelha `Servico.preco_para` no backend — sugestão baixa a
 *  Patricia corrige; campo vazio a faz digitar do zero em todo atendimento. */
export function precoParaPorte(servico: Servico, porte: Porte): string {
  if (porte === "M" && servico.preco_m) return servico.preco_m;
  if (porte === "G" && servico.preco_g) return servico.preco_g;
  return servico.preco_padrao;
}

/** Pet agressivo ou que exige contenção especial: +40% sobre o serviço (tempo extra,
 *  manejo diferenciado, segurança da equipe). Regra da tabela da Patricia. */
export const ACRESCIMO_MANEJO = 1.4;

export interface Pacote {
  id: number;
  pet: number;
  pet_nome: string;
  tutor_nome: string;
  servico: number;
  servico_nome: string;
  competencia: string;
  qtd_total: number;
  valor_pago: string;
  data_compra: string;
  validade: string;
  /** Derivado no backend (invariante 4): qtd_total - atendimentos não cancelados. */
  saldo: number;
}

export interface PacoteEntrada {
  pet: number;
  servico: number;
  /** Sempre o dia 1 do mês ("2026-07-01"); o backend normaliza de qualquer forma. */
  competencia: string;
  qtd_total: number;
  valor_pago: string;
  data_compra: string;
  validade: string;
}

export type TipoCusto = "fixo" | "variavel";

export interface Custo {
  id: number;
  tipo: TipoCusto;
  descricao: string;
  valor: string;
  categoria: string;
  /** Sempre o dia 1 do mês ("2026-07-01"): a competência da invariante 10. */
  competencia: string;
}

export type CustoEntrada = Omit<Custo, "id">;

export interface Retirada {
  id: number;
  descricao: string;
  valor: string;
  /** Data real do saque, não competência: é assim que o dashboard soma retiradas. */
  data: string;
  tipo: string;
}

export type RetiradaEntrada = Omit<Retirada, "id">;

export interface TopTutor {
  id: number;
  nome: string;
  gasto_total: string;
}

/** Uma fatia do gráfico de despesas. O backend já funde as variações de digitação
 *  ("Aluguel" / "aluguel") e corta a cauda numa linha "Outros". */
export interface CategoriaCusto {
  categoria: string;
  valor: string;
}

/** Um mês do gráfico. `competencia` é sempre o dia 1 ("2026-06-01"). */
export interface PontoSerie {
  competencia: string;
  faturamento: string;
  custos: string;
  lucro: string;
}

/** Resposta do GET /dashboard/. Todo valor monetário vem como string (DecimalField
 *  do DRF); `margem` é fração 0–1. Os KPIs são derivados em query (invariante 9). */
export interface ResumoFinanceiro {
  faturamento: string;
  /** Parcela do faturamento que veio das corridas (já somada em `faturamento`).
   *  Sai em separado para responder "o triciclo se paga?" e para conciliar com a
   *  planilha, que sempre contou o transporte na receita. */
  transporte: string;
  custos: string;
  retiradas: string;
  lucro: string;
  ticket_medio: string;
  margem: string;
  /** Visitas Liberadas no período, incluindo consumo de pacote. NÃO é o denominador
   *  do ticket médio, que conta eventos de receita (venda de pacote + avulso). */
  qtd_atendimentos: number;
  /** Contagem do cadastro (Pet.ativo), não do período. */
  pets_ativos: number;
  vip: Pet[];
  top_tutores: TopTutor[];
  custos_por_categoria: CategoriaCusto[];
}

export type TipoTransacao = "atendimento" | "pacote" | "custo" | "retirada";

/** Uma linha do feed de caixa. `valor` é sempre positivo: o sinal é derivado do
 *  `tipo` na tela. Consumo de pacote não aparece aqui (invariante 1). */
export interface Transacao {
  tipo: TipoTransacao;
  descricao: string;
  valor: string;
  /** Para custo é a competência (dia 1 sintético), não uma data real de pagamento. */
  data: string;
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
  manejo_especial: boolean;
  status: StatusAtendimento;
  pagamentos: PagamentoEntrada[];
}
