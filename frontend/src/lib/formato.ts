/** "1200.5" -> "R$ 1200,50". Aceita number porque somas locais (ex.: o total dos
 *  pagamentos) já chegam calculadas; a API sempre manda DecimalField como string. */
export function formatarPreco(valor: string | number): string {
  return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
}
