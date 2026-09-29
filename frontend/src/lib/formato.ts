/** "1200.5" -> "R$ 1200,50". Aceita number porque somas locais (ex.: o total dos
 *  pagamentos) já chegam calculadas; a API sempre manda DecimalField como string. */
export function formatarPreco(valor: string | number): string {
  return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
}

/** "23194.00" -> "R$ 23,2k". Para rótulo de barra, onde "R$ 23194,00" não cabe.
 *  Só em rótulo de gráfico: nos cards o valor vai inteiro, sem arredondar dinheiro. */
export function formatarPrecoCurto(valor: string | number): string {
  const numero = Number(valor);
  if (Math.abs(numero) >= 1000) {
    return `R$ ${(numero / 1000).toFixed(1).replace(".", ",")}k`;
  }
  return `R$ ${Math.round(numero)}`;
}

/** Saldo do pacote em palavras. "1/4" deixava a dúvida se era usado ou restante; o
 *  número do backend é o que RESTA (invariante 4), e a frase diz isso. */
export function textoSaldo(saldo: number, total: number): string {
  if (saldo <= 0) return "sem créditos";
  return `${saldo === 1 ? "resta" : "restam"} ${saldo} de ${total}`;
}

/** "0.6490" -> "64,9%". O backend manda margem como fração 0–1, não como percentual:
 *  multiplicar aqui e não lá mantém o número financeiro cru na API. */
export function formatarPercentual(fracao: string | number): string {
  return `${(Number(fracao) * 100).toFixed(1).replace(".", ",")}%`;
}
