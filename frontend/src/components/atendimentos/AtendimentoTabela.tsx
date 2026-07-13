import { Link } from "react-router-dom";
import { formatarData } from "../../lib/competencia";
import { formatarPreco } from "../../lib/formato";
import type { Atendimento, StatusAtendimento } from "../../lib/types";
import { Badge } from "../ui/Badge";
import { StatusAcao } from "./StatusAcao";

const VARIANTE_STATUS: Record<StatusAtendimento, "sucesso" | "pendente" | "erro"> = {
  Liberado: "sucesso",
  Pendente: "pendente",
  Cancelado: "erro",
};

export function AtendimentoTabela({ atendimentos }: { atendimentos: Atendimento[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
            <th className="px-6 py-3 font-semibold">Data</th>
            <th className="px-2 py-3 font-semibold">Pet / Tutor</th>
            <th className="px-2 py-3 font-semibold">Serviço</th>
            <th className="px-2 py-3 font-semibold">Origem</th>
            <th className="px-2 py-3 font-semibold">Status</th>
            <th className="px-2 py-3 text-right font-semibold">Valor</th>
            <th className="px-6 py-3 text-right font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody>
          {atendimentos.map((a) => (
            <tr key={a.id} className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50">
              <td className="px-6 py-4">
                <div className="font-mono font-semibold text-escuro">{formatarData(a.data)}</div>
                <div className="font-mono text-xs text-neutro">{a.horario.slice(0, 5)}</div>
              </td>
              <td className="px-2 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutro-light/40 font-semibold text-escuro">
                    {a.pet_nome.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className="font-medium text-escuro">{a.pet_nome}</div>
                    <div className="text-xs text-neutro">{a.tutor_nome}</div>
                  </div>
                </div>
              </td>
              <td className="px-2 py-4 text-escuro">{a.servico_nome}</td>
              <td className="px-2 py-4">
                <Badge variant={a.pacote !== null ? "neutro" : "pendente"}>
                  {a.pacote !== null ? "Pacote" : "Avulso"}
                </Badge>
              </td>
              <td className="px-2 py-4">
                <Badge variant={VARIANTE_STATUS[a.status]}>{a.status}</Badge>
              </td>
              <td className="px-2 py-4 text-right font-mono font-semibold text-escuro">
                {formatarPreco(a.valor)}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2">
                  <Link to={`/atendimentos/${a.id}/editar`} className="text-sm font-medium text-marsala hover:underline">
                    Editar
                  </Link>
                  <StatusAcao atendimento={a} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
