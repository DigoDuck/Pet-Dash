// Separador de milhar: "R$ 10400,00" e "R$ 1040,00" diferiam por um dígito que ela
// precisava contar, e a planilha de onde ela vem sempre mostrou "10.400,00". Só o
// número passa pelo Intl; o "R$ " fica à mão porque o estilo `currency` insere um
// espaço não separável, que muda o texto e quebraria toda busca por "R$ ".
const NUMERO_BR = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1200.5" -> "R$ 1.200,50". Aceita number porque somas locais (ex.: o total dos
 *  pagamentos) já chegam calculadas; a API sempre manda DecimalField como string.
 *
 *  O que não vira número devolve traço, nunca "R$ NaN". O caso real: front e API
 *  fazem deploy separados (Vercel e Railway), então toda entrega tem uma janela em
 *  que a tela nova pede um campo que a API antiga ainda não manda. `Number(undefined)`
 *  é NaN, e o tipo em `types.ts` promete `string` — a promessa vale para o payload
 *  novo, não para a versão que está no ar naquele minuto.
 *
 *  Traço e não zero pelo mesmo motivo do KpiCard: zero é um número, e um número
 *  errado numa tela de dinheiro é pior que a ausência dele. */
export function formatarPreco(valor: string | number): string {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "—";
  return `R$ ${NUMERO_BR.format(numero)}`;
}

/** "23194.00" -> "R$ 23,2k". Para rótulo de barra, onde "R$ 23194,00" não cabe.
 *  Só em rótulo de gráfico: nos cards o valor vai inteiro, sem arredondar dinheiro. */
export function formatarPrecoCurto(valor: string | number): string {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "—";
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
