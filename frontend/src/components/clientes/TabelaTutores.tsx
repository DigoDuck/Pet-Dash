import { Link } from "react-router-dom";
import type { Tutor } from "../../lib/types";

export function TabelaTutores({ tutores }: { tutores: Tutor[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
            <th className="px-6 py-3 font-semibold">Tutor</th>
            <th className="px-2 py-3 font-semibold">Telefone</th>
            <th className="px-6 py-3 font-semibold">E-mail</th>
          </tr>
        </thead>
        <tbody>
          {tutores.map((tutor) => (
            <tr
              key={tutor.id}
              className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50"
            >
              <td className="px-6 py-4">
                <Link to={`/clientes/${tutor.id}`} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-marsala font-semibold text-creme">
                    {tutor.nome.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium text-escuro">{tutor.nome}</span>
                </Link>
              </td>
              <td className="px-2 py-4 font-mono text-neutro">{tutor.telefone}</td>
              <td className="px-6 py-4 text-neutro">{tutor.email || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
