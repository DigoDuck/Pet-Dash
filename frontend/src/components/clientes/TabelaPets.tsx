import { Link } from "react-router-dom";
import { ROTULOS_PORTE, type Pet } from "../../lib/types";
import { BadgesPet } from "./BadgesPet";

export function TabelaPets({ pets }: { pets: Pet[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
            <th className="px-6 py-3 font-semibold">Pet</th>
            <th className="px-2 py-3 font-semibold">Tutor</th>
            <th className="px-2 py-3 font-semibold">Porte</th>
            <th className="px-6 py-3 font-semibold">Alertas</th>
          </tr>
        </thead>
        <tbody>
          {pets.map((pet) => (
            <tr
              key={pet.id}
              className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50"
            >
              <td className="px-6 py-4">
                <Link to={`/pets/${pet.id}`} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-marsala font-semibold text-creme">
                    {pet.nome.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium text-escuro">{pet.nome}</span>
                </Link>
              </td>
              <td className="px-2 py-4 text-neutro">{pet.tutor_nome}</td>
              <td className="px-2 py-4 text-neutro">{ROTULOS_PORTE[pet.porte]}</td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  <BadgesPet pet={pet} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
