import { formatarData, mesCurto } from "../../lib/competencia";
import { formatarPreco } from "../../lib/formato";
import type { TipoTransacao, Transacao } from "../../lib/types";
import { Card } from "../ui/Card";

interface Estilo {
  rotulo: string;
  entrada: boolean;
}

/** Saída é marsala, não vermelho: um aluguel pago não é um erro. O vermelho fica
 *  reservado para o que de fato deu errado na tela. */
const ESTILOS: Record<TipoTransacao, Estilo> = {
  atendimento: { rotulo: "Serviço", entrada: true },
  pacote: { rotulo: "Pacote", entrada: true },
  custo: { rotulo: "Custo", entrada: false },
  retirada: { rotulo: "Retirada", entrada: false },
};

/** Custo tem competência (dia 1 sintético), não data de pagamento. Exibir "01/06/2026"
 *  afirmaria um dia que ninguém registrou; "Jun/2026" diz a verdade que existe. */
function quando(transacao: Transacao): string {
  if (transacao.tipo === "custo") {
    return `${mesCurto(transacao.data)}/${transacao.data.slice(0, 4)}`;
  }
  return formatarData(transacao.data);
}

interface TransacoesRecentesProps {
  transacoes: Transacao[];
}

export function TransacoesRecentes({ transacoes }: TransacoesRecentesProps) {
  return (
    <Card>
      <h2 className="font-display text-xl text-escuro">Movimentações recentes</h2>
      {/* Sem esta linha, a Patricia conta 4 banhos de pacote no mês, vê só a venda no
          feed e conclui que o sistema perdeu atendimentos. */}
      <p className="mt-1 text-sm text-neutro">
        Entradas e saídas de caixa. O banho consumido do pacote não aparece: já foi pago na venda.
      </p>

      {transacoes.length === 0 ? (
        <p className="mt-6 text-sm text-neutro">Nenhuma movimentação neste mês.</p>
      ) : (
        <ul className="mt-5 divide-y divide-neutro-light/50">
          {transacoes.map((transacao, i) => {
            const { rotulo, entrada } = ESTILOS[transacao.tipo];
            return (
              <li
                key={`${transacao.tipo}-${transacao.data}-${i}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutro-light/40 text-sm font-semibold text-escuro"
                  >
                    {transacao.descricao.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-escuro">
                      {transacao.descricao}
                    </span>
                    <span className="block text-xs text-neutro">
                      {rotulo} · {quando(transacao)}
                    </span>
                  </span>
                </span>
                <span
                  className={`shrink-0 font-mono text-sm font-semibold ${
                    entrada ? "text-sucesso" : "text-marsala"
                  }`}
                >
                  {entrada ? "+" : "−"} {formatarPreco(transacao.valor)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
