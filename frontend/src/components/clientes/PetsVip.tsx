import { Link } from "react-router-dom";
import { formatarPreco } from "../../lib/formato";
import type { Pet } from "../../lib/types";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

interface PetsVipProps {
  pets: Pet[];
}

/** VIP é calculado, nunca armazenado (invariante 6): 3+ visitas OU R$500+ no período.
 *  Os números vêm anotados na query do dashboard — não recalcular aqui. */
export function PetsVip({ pets }: PetsVipProps) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl text-escuro">Pets VIP</h2>
        <Badge variant="vip">{pets.length}</Badge>
      </div>
      <p className="mt-1 text-sm text-neutro">3+ visitas ou R$ 500+ no mês</p>

      {pets.length === 0 ? (
        <p className="mt-6 text-sm text-neutro">Nenhum pet atingiu o critério neste mês.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {pets.map((pet) => (
            <li key={pet.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0">
                <Link
                  to={`/pets/${pet.id}`}
                  className="block truncate text-escuro hover:text-marsala hover:underline"
                >
                  {pet.nome}
                </Link>
                <span className="block truncate text-xs text-neutro">{pet.tutor_nome}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono font-semibold text-escuro">
                  {formatarPreco(pet.total_gasto)}
                </span>
                <span className="block text-xs text-neutro">
                  {pet.qtd_visitas} {pet.qtd_visitas === 1 ? "visita" : "visitas"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
