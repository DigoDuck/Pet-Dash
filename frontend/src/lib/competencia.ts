/** "2026-07" -> "2026-07-01". O backend normaliza a competência para o dia 1. */
export function inicioDaCompetencia(mes: string): string {
  return `${mes}-01`;
}

/** "2026-07-01" -> "2026-07", formato do <input type="month">. */
export function mesDaCompetencia(competencia: string): string {
  return competencia.slice(0, 7);
}

/** "2026-07" -> "2026-07-31". Dia 0 do mês seguinte é o último do mês pedido;
 *  em UTC para o fuso local não empurrar a data um dia para trás. */
export function ultimoDiaDoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, m, 0)).toISOString().slice(0, 10);
}

export function mesCorrente(hoje: Date = new Date()): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

/** Data local em ISO. Não usar toISOString() aqui: à noite no fuso -03 ele
 *  devolveria o dia seguinte. */
export function hojeISO(hoje: Date = new Date()): string {
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${mesCorrente(hoje)}-${dia}`;
}

/** "2026-07-31" -> "31/07/2026". Sem passar por Date: a string já é a verdade. */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** A segunda-feira da semana de `iso`. Domingo pertence à semana que termina nele.
 *
 *  Em UTC: `new Date("2026-07-08")` já é UTC, e misturar com getDay() local retrocede
 *  um dia à noite em -03 — a semana inteira sairia deslocada. */
export function inicioDaSemana(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const diaDaSemana = d.getUTCDay(); // 0 = domingo
  const recuo = diaDaSemana === 0 ? 6 : diaDaSemana - 1;
  d.setUTCDate(d.getUTCDate() - recuo);
  return d.toISOString().slice(0, 10);
}

/** Os `n` dias a partir de `iso`, em ISO. Agenda usa 6 (segunda a sábado). */
export function diasDaSemana(iso: string, n = 6): string[] {
  const base = new Date(`${iso}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** "2026-07-08" + 7 -> "2026-07-15". Negativo anda para trás. */
export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "2026-07-08" -> "Qua". */
export function diaCurto(iso: string): string {
  return DIAS_CURTOS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

const MESES_CURTOS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/** "2026-06-01" -> "Jun". Rótulo do eixo do gráfico. */
export function mesCurto(competencia: string): string {
  return MESES_CURTOS[Number(competencia.slice(5, 7)) - 1];
}

/** Os `n` meses que terminam em `mes`, em ordem cronológica.
 *  mesesAnteriores("2026-02", 6) -> ["2025-09", ..., "2026-02"].
 *
 *  Date.UTC absorve a virada de ano (mês -1 vira dezembro do ano anterior sozinho)
 *  e evita o retrocesso de um dia que o construtor local causa à noite em -03. */
export function mesesAnteriores(mes: string, n: number): string[] {
  const [ano, m] = mes.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const data = new Date(Date.UTC(ano, m - 1 - (n - 1 - i), 1));
    return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
