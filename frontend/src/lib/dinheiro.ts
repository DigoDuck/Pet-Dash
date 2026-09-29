import { z } from "zod";

const DECIMAL = /^\d+(\.\d{1,2})?$/;

/** "65,00" -> "65.00" e "1.200,50" -> "1200.50".
 *
 *  O teclado brasileiro digita vírgula; o DecimalField do DRF só aceita ponto. Recusar
 *  era o que acontecia: "220,00" dava "Valor inválido" em todo lançamento de quem vem
 *  da planilha. Com vírgula presente, os pontos são separador de milhar e saem. Sem
 *  vírgula, o texto fica como está ("65.00" continua valendo). */
export function normalizarDecimal(valor: string): string {
  const limpo = valor.trim();
  return limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
}

/** Soma e compara valores digitados, aceitem eles vírgula ou ponto. Vazio conta zero. */
export function paraNumero(valor: string | number | null | undefined): number {
  if (typeof valor === "number") return valor;
  return Number(normalizarDecimal(valor ?? "") || 0);
}

/** Campo de dinheiro para zod: aceita vírgula e entrega o texto com ponto ao envio. */
export function campoDinheiro(exemplo: string) {
  return z
    .string()
    .transform(normalizarDecimal)
    .pipe(z.string().regex(DECIMAL, `Valor inválido (ex.: ${exemplo})`));
}

/** Mesmo campo, mas vazio é permitido (preço opcional do catálogo). */
export function campoDinheiroOpcional(exemplo: string) {
  return z
    .string()
    .transform(normalizarDecimal)
    .pipe(z.string().regex(DECIMAL, `Valor inválido (ex.: ${exemplo})`).or(z.literal("")));
}
