import { useDashboard } from "../../hooks/useDashboard";
import { formatarPreco } from "../../lib/formato";
import type { ResumoFinanceiro } from "../../lib/types";
import { Card } from "../ui/Card";
import { KpiCard } from "../ui/KpiCard";

interface ResumoMesProps {
  inicio: string;
  fim: string;
}

/** O campo como número, ou `null` quando ele não dá um número utilizável.
 *
 *  `types.ts` promete `string`, e a promessa vale para o payload novo — não para a
 *  versão da API que está no ar naquele minuto. Front (Vercel) e API (Railway) fazem
 *  deploy separados, então toda entrega tem uma janela em que a tela nova pede um
 *  campo que a API antiga ainda não manda. Foi o que produziu "R$ NaN" na tela. */
function numero(valor: string | undefined): number | null {
  if (valor === undefined) return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

/** Os totais do mês. Vêm agregados do backend (invariante 9), e não da soma das
 *  linhas da tabela: somar no cliente só acertaria enquanto tudo coubesse na
 *  primeira página, e passaria a mentir em silêncio depois. Por isso o filtro
 *  fixo/variável da tabela não mexe aqui — os cards são sempre o mês inteiro. */
export function ResumoMes({ inicio, fim }: ResumoMesProps) {
  const { data, isPending, isError } = useDashboard(inicio, fim);
  // Sem o campo (API antiga no ar), a linha some em vez de virar "Transporte: —":
  // o total ao lado continua certo, e um recorte ausente não é notícia.
  const custoTransporte = isError ? null : numero(data?.custo_transporte);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        rotulo="Custos do mês"
        valor={data && formatarPreco(data.custos)}
        sub={custoTransporte === null ? undefined : `Transporte: ${formatarPreco(custoTransporte)}`}
        carregando={isPending}
        erro={isError}
      />
      <KpiCard
        rotulo="Retiradas do mês"
        valor={data && formatarPreco(data.retiradas)}
        carregando={isPending}
        erro={isError}
      />
      <TransporteDoMes dados={data} carregando={isPending} erro={isError} />
    </div>
  );
}

interface TransporteDoMesProps {
  dados?: ResumoFinanceiro;
  carregando: boolean;
  erro: boolean;
}

/** "O triciclo se paga?" — a pergunta que a Patricia faz desde a planilha, e que
 *  nenhum dos dois números responde sozinho: a receita da corrida vive dentro do
 *  faturamento, o custo dela vive diluído no total de custos.
 *
 *  O custo é um recorte do total, não uma despesa a mais: ele já está em "Custos do
 *  mês". O rodapé diz de onde o número sai porque ele depende de a Patricia lançar o
 *  combustível com a categoria "Transporte" — um zero sem explicação nesta tela
 *  pareceria mês sem gasto, e não categoria esquecida. */
function TransporteDoMes({ dados, carregando, erro }: TransporteDoMesProps) {
  // O `erro` zera os três mesmo com `dados` preenchido: a query usa keepPreviousData,
  // então uma falha depois de trocar o mês deixaria os números do mês ANTERIOR na
  // tela sob o rótulo do novo — pior que não mostrar nada.
  const corridas = erro ? null : numero(dados?.transporte);
  const custo = erro ? null : numero(dados?.custo_transporte);
  const saldo = corridas !== null && custo !== null ? corridas - custo : null;

  // Mesma regra do KpiCard: traço, e nunca um zero inventado. Zero é um número, e um
  // número errado numa tela de dinheiro é pior que a ausência dele.
  const vazio = carregando ? "..." : "—";

  return (
    <Card>
      <p className="text-[10px] font-semibold tracking-[0.12em] text-neutro uppercase">
        Transporte
      </p>
      <dl className="mt-2 space-y-1.5 text-sm">
        <Linha
          rotulo="Corridas"
          valor={corridas === null ? vazio : `+ ${formatarPreco(corridas)}`}
          cor={corridas === null ? "text-neutro" : "text-sucesso"}
        />
        <Linha
          rotulo="Custo"
          valor={custo === null ? vazio : `− ${formatarPreco(custo)}`}
          cor={custo === null ? "text-neutro" : "text-marsala"}
        />
        <div className="border-t border-neutro-light/60 pt-1.5">
          <Linha
            rotulo="Saldo"
            valor={saldo === null ? vazio : formatarSaldo(saldo)}
            cor={
              saldo === null || saldo === 0
                ? "text-escuro"
                : saldo > 0
                  ? "text-sucesso"
                  : "text-marsala"
            }
            forte
          />
        </div>
      </dl>
      <p className="mt-3 text-xs text-neutro">
        Custos lançados na categoria &quot;Transporte&quot;, já inclusos no total do mês.
      </p>
    </Card>
  );
}

/** O sinal fica fora do `formatarPreco` porque ele não formata negativo: o `-` do
 *  Number cairia depois do "R$" ("R$ -80,00"). */
function formatarSaldo(saldo: number): string {
  const sinal = saldo > 0 ? "+ " : saldo < 0 ? "− " : "";
  return `${sinal}${formatarPreco(Math.abs(saldo))}`;
}

function Linha({
  rotulo,
  valor,
  cor,
  forte = false,
}: {
  rotulo: string;
  valor: string;
  cor: string;
  forte?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={forte ? "text-escuro" : "text-neutro"}>{rotulo}</dt>
      <dd className={`font-mono font-semibold ${forte ? "text-base" : ""} ${cor}`}>{valor}</dd>
    </div>
  );
}
