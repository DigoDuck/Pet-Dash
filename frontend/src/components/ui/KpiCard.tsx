import { Card } from "./Card";

interface KpiCardProps {
  rotulo: string;
  /** Já formatado pelo chamador: o card serve tanto para dinheiro quanto para percentual. */
  valor?: string;
  sub?: string;
  carregando: boolean;
  erro: boolean;
}

/** O número grande do topo das telas financeiras.
 *
 *  Um traço em vez de "R$ 0,00" quando a query falha: zero é um número, e um número
 *  errado numa tela de dinheiro é pior do que a ausência dele. */
export function KpiCard({ rotulo, valor, sub, carregando, erro }: KpiCardProps) {
  return (
    <Card>
      <p className="text-[10px] font-semibold tracking-[0.12em] text-neutro uppercase">{rotulo}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-escuro">
        {erro ? "—" : carregando || valor == null ? "..." : valor}
      </p>
      {sub && !erro && !carregando && <p className="mt-1 text-xs text-neutro">{sub}</p>}
    </Card>
  );
}
