import { formatarData } from "../../lib/competencia";
import { formatarPreco } from "../../lib/formato";
import type { Atendimento, StatusAtendimento } from "../../lib/types";
import { Badge } from "../ui/Badge";

const VARIANTE_STATUS: Record<StatusAtendimento, "sucesso" | "pendente" | "erro"> = {
  Liberado: "sucesso",
  Pendente: "pendente",
  Cancelado: "erro",
};

export function HistoricoTabela({ atendimentos }: { atendimentos: Atendimento[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
            <th className="px-6 py-3 font-semibold">Data</th>
            <th className="px-2 py-3 font-semibold">Serviço</th>
            <th className="hidden px-2 py-3 font-semibold md:table-cell">Origem</th>
            <th className="hidden px-2 py-3 font-semibold md:table-cell">Situação</th>
            <th className="px-6 py-3 text-right font-semibold">Valor</th>
          </tr>
        </thead>
        <tbody>
          {atendimentos.map((a) => (
            <tr
              key={a.id}
              className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50"
            >
              <td className="px-6 py-4 font-mono text-escuro">{formatarData(a.data)}</td>
              {/* Abaixo de `md`, origem e status se dobram sob o serviço: com cinco
                  colunas, o Valor ficava fora da tela no celular. */}
              <td className="px-2 py-4">
                <span className="font-medium text-escuro">{a.servico_nome}</span>
                <span className="mt-1.5 flex flex-wrap gap-1.5 md:hidden">
                  <Badge variant={VARIANTE_STATUS[a.status]}>{a.status}</Badge>
                  <Badge variant="neutro">{a.pacote !== null ? "Pacote" : "Avulso"}</Badge>
                </span>
              </td>
              <td className="hidden px-2 py-4 md:table-cell">
                {/* Consumo de pacote se reconhece pelo vínculo, nunca por valor zero. */}
                <Badge variant="neutro">
                  {a.pacote !== null ? "Pacote" : "Avulso"}
                </Badge>
              </td>
              <td className="hidden px-2 py-4 md:table-cell">
                <Badge variant={VARIANTE_STATUS[a.status]}>{a.status}</Badge>
              </td>
              <td className="px-6 py-4 text-right font-mono font-semibold text-escuro">
                {formatarPreco(a.valor)}
                {/* Mesmo aviso da lista de atendimentos: o valor do consumo é referência. */}
                {a.pacote !== null && (
                  <span className="block font-sans text-xs font-normal text-neutro">
                    já pago no pacote
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
