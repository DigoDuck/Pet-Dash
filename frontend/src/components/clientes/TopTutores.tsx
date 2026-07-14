import { Link } from "react-router-dom";
import { formatarPreco } from "../../lib/formato";
import type { TopTutor } from "../../lib/types";
import { Card } from "../ui/Card";

interface TopTutoresProps {
  tutores: TopTutor[];
}

/** Query paralela ao VIP, e não um substituto dele: o VIP é por pet, então um tutor
 *  com três pets abaixo do limite nunca vira VIP (ponto cego aceito na invariante 6).
 *  Esta lista soma por tutor e é a mitigação desse ponto cego. */
export function TopTutores({ tutores }: TopTutoresProps) {
  return (
    <Card>
      <h2 className="font-display text-xl text-escuro">Top tutores do mês</h2>
      <p className="mt-1 text-sm text-neutro">Por gasto total no período</p>

      {tutores.length === 0 ? (
        <p className="mt-6 text-sm text-neutro">Nenhum atendimento liberado neste mês.</p>
      ) : (
        <ol className="mt-5 space-y-3">
          {tutores.map((tutor, i) => (
            <li key={tutor.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-marsala/10 font-mono text-xs font-semibold text-marsala">
                  {i + 1}
                </span>
                <Link
                  to={`/clientes/${tutor.id}`}
                  className="truncate text-escuro hover:text-marsala hover:underline"
                >
                  {tutor.nome}
                </Link>
              </span>
              <span className="shrink-0 font-mono font-semibold text-escuro">
                {formatarPreco(tutor.gasto_total)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
