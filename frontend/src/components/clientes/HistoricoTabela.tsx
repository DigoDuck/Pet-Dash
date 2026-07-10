import type { Atendimento, StatusAtendimento } from "../../lib/types";
import { Badge } from "../ui/Badge";

const VARIANTE_STATUS: Record<StatusAtendimento, "sucesso" | "pendente" | "erro"> = {
  Liberado: "sucesso",
  Pendente: "pendente",
  Cancelado: "erro",
};

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarValor(valor: string): string {
  return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
}

export function HistoricoTabela({ atendimentos }: { atendimentos: Atendimento[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
            <th className="px-6 py-3 font-semibold">Data</th>
            <th className="px-2 py-3 font-semibold">Serviço</th>
            <th className="px-2 py-3 font-semibold">Origem</th>
            <th className="px-2 py-3 font-semibold">Status</th>
            <th className="px-6 py-3 text-right font-semibold">Valor</th>
          </tr>
        </thead>
        <tbody>
          {atendimentos.map((a) => (
            <tr
              key={a.id}
              className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50"
            >
              <td className="px-6 py-4 font-mono text-neutro">{formatarData(a.data)}</td>
              <td className="px-2 py-4 font-medium text-escuro">{a.servico_nome}</td>
              <td className="px-2 py-4">
                {/* Consumo de pacote se reconhece pelo vínculo, nunca por valor zero. */}
                <Badge variant={a.pacote !== null ? "neutro" : "pendente"}>
                  {a.pacote !== null ? "Pacote" : "Avulso"}
                </Badge>
              </td>
              <td className="px-2 py-4">
                <Badge variant={VARIANTE_STATUS[a.status]}>{a.status}</Badge>
              </td>
              <td className="px-6 py-4 text-right font-mono font-semibold text-escuro">
                {formatarValor(a.valor)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
