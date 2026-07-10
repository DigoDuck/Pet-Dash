import { Link } from "react-router-dom";
import type { Pet } from "../../lib/types";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

const ROTULOS_PORTE: Record<Pet["porte"], string> = {
  "": "Porte não informado",
  P: "Pequeno",
  M: "Médio",
  G: "Grande",
};

export function PetCard({ pet }: { pet: Pet }) {
  return (
    <Link to={`/pets/${pet.id}`} className="block">
      <Card className="transition-colors hover:border-ouro/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-escuro">{pet.nome}</p>
            <p className="text-xs text-neutro">
              {pet.raca || "Sem raça definida"} · {ROTULOS_PORTE[pet.porte]}
            </p>
          </div>
          {pet.vip && <Badge variant="vip">VIP</Badge>}
        </div>
      </Card>
    </Link>
  );
}
