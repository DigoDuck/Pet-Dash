import { Link } from "react-router-dom";
import { ROTULOS_PORTE, type Pet } from "../../lib/types";
import { Card } from "../ui/Card";
import { BadgesPet } from "./BadgesPet";

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
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <BadgesPet pet={pet} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
