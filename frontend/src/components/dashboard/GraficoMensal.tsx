import { mesCurto, mesDaCompetencia } from "../../lib/competencia";
import { formatarPrecoCurto } from "../../lib/formato";
import type { PontoSerie } from "../../lib/types";
import { Card } from "../ui/Card";

const ALTURA_PX = 200;

/** Altura da barra em porcentagem da mais alta da série.
 *
 *  O `|| 1` não é paranoia: num mês sem nenhum movimento o máximo é 0, a divisão
 *  vira NaN e o React renderiza `height: NaN%` — a barra some e o layout quebra sem
 *  nenhum erro no console. */
function alturaPercentual(valor: number, maximo: number): number {
  return (valor / (maximo || 1)) * 100;
}

interface GraficoMensalProps {
  serie: PontoSerie[];
  /** "2026-07" — o mês dos KPIs, destacado entre as barras. */
  mesSelecionado: string;
}

/** Faturamento × custos dos últimos meses, em barras de CSS.
 *
 *  Sem biblioteca de gráfico: são 12 barras num app 100% web cuja usuária tem
 *  máquina fraca, e Recharts custaria ~100KB de bundle para desenhar divs. Os
 *  valores vão no `aria-label` de cada coluna, então o teste lê números em vez de
 *  medir pixels — e o leitor de tela também. */
export function GraficoMensal({ serie, mesSelecionado }: GraficoMensalProps) {
  const maximo = Math.max(
    ...serie.flatMap((ponto) => [Number(ponto.faturamento), Number(ponto.custos)]),
    0,
  );

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl text-escuro">Fluxo de caixa</h2>
          <p className="mt-1 text-sm text-neutro">Últimos {serie.length} meses</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutro">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-marsala" /> Faturamento
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-ouro" /> Custos
          </span>
        </div>
      </div>

      <div className="mt-8 flex gap-2 sm:gap-4" style={{ height: ALTURA_PX + 28 }}>
        {serie.map((ponto) => {
          const selecionado = mesDaCompetencia(ponto.competencia) === mesSelecionado;
          return (
            <div key={ponto.competencia} className="flex flex-1 flex-col justify-end gap-2">
              <div
                role="img"
                aria-label={`${mesCurto(ponto.competencia)}: faturamento ${formatarPrecoCurto(
                  ponto.faturamento,
                )}, custos ${formatarPrecoCurto(ponto.custos)}`}
                className="flex items-end justify-center gap-1"
                style={{ height: ALTURA_PX }}
              >
                <Barra
                  percentual={alturaPercentual(Number(ponto.faturamento), maximo)}
                  cor="bg-marsala"
                />
                <Barra percentual={alturaPercentual(Number(ponto.custos), maximo)} cor="bg-ouro" />
              </div>
              <span
                className={`text-center text-[11px] ${
                  selecionado ? "font-semibold text-marsala" : "text-neutro"
                }`}
              >
                {mesCurto(ponto.competencia)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** `min-h-[2px]`: um mês com movimento pequeno perto de um mês grande arredonda para
 *  0px e some, o que se lê como "não houve nada" em vez de "houve pouco". */
function Barra({ percentual, cor }: { percentual: number; cor: string }) {
  return (
    <div
      data-testid="barra"
      className={`w-3 rounded-t sm:w-4 ${cor} ${percentual > 0 ? "min-h-[2px]" : ""}`}
      style={{ height: `${percentual}%` }}
    />
  );
}
