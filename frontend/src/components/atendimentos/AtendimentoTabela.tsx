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

/** Abaixo de `md` sobram três colunas: Pet, Valor e Ações.
 *
 *  As outras quatro saem com `hidden md:table-cell` em vez de virarem card. Card seria
 *  marcação duplicada em nove tabelas, e coluna nova depois teria que ser lembrada em
 *  dois lugares. Escondendo, a semântica de tabela fica intacta e — o ponto — a coluna
 *  Ações volta a caber: com sete colunas ela ficava permanentemente fora da tela, e
 *  Liberar/Cancelar eram inalcançáveis no celular.
 *
 *  O que sai da linha não some da tela: data, hora, serviço, origem e status se dobram
 *  dentro da célula do pet. Só a repetição visual é cortada, nunca a informação. */
export function AtendimentoTabela({ atendimentos }: { atendimentos: Atendimento[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
            <th className="hidden px-6 py-3 font-semibold md:table-cell">Data</th>
            <th className="px-6 py-3 font-semibold md:px-2">Pet / Tutor</th>
            <th className="hidden px-2 py-3 font-semibold md:table-cell">Serviço</th>
            <th className="hidden px-2 py-3 font-semibold md:table-cell">Origem</th>
            <th className="hidden px-2 py-3 font-semibold md:table-cell">Status</th>
            <th className="px-2 py-3 text-right font-semibold">Valor</th>
            <th className="px-6 py-3 text-right font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody>
          {atendimentos.map((a) => {
            const origem = a.pacote !== null ? "Pacote" : "Avulso";
            return (
              <tr key={a.id} className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50">
                <td className="hidden px-6 py-4 md:table-cell">
                  <div className="font-mono font-semibold text-escuro">{formatarData(a.data)}</div>
                  <div className="font-mono text-xs text-neutro">{a.horario.slice(0, 5)}</div>
                </td>
                <td className="px-6 py-4 md:px-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutro-light/40 font-semibold text-escuro">
                      {a.pet_nome.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-medium text-escuro">
                        <span className="truncate">{a.pet_nome}</span>
                        {a.pet_vip && (
                          <Badge variant="vip" className="shrink-0 px-1.5 py-px text-[9px] tracking-wider uppercase">
                            VIP
                          </Badge>
                        )}
                      </div>
                      <div className="truncate text-xs text-neutro">
                        {a.tutor_nome}
                        <span className="md:hidden"> · {a.servico_nome}</span>
                      </div>
                      {/* O que as colunas escondidas carregavam. Data e status decidem se
                          ela precisa agir na linha; a origem diz se aquele valor entra ou
                          não no caixa do mês (invariantes 1 e 2). Nenhum dos três pode
                          depender de rolar a tabela para o lado. */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
                        <span className="font-mono text-xs text-neutro">
                          {formatarData(a.data)} · {a.horario.slice(0, 5)}
                        </span>
                        <Badge variant={VARIANTE_STATUS[a.status]}>{a.status}</Badge>
                        <Badge variant={a.pacote !== null ? "neutro" : "pendente"}>{origem}</Badge>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="hidden px-2 py-4 text-escuro md:table-cell">{a.servico_nome}</td>
                <td className="hidden px-2 py-4 md:table-cell">
                  <Badge variant={a.pacote !== null ? "neutro" : "pendente"}>{origem}</Badge>
                </td>
                <td className="hidden px-2 py-4 md:table-cell">
                  <Badge variant={VARIANTE_STATUS[a.status]}>{a.status}</Badge>
                </td>
                <td className="px-2 py-4 text-right font-mono font-semibold text-escuro">
                  {formatarPreco(a.valor)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col items-end gap-2 md:flex-row md:items-center md:justify-end">
                    <Link to={`/atendimentos/${a.id}/editar`} className="text-sm font-medium text-marsala hover:underline">
                      Editar
                    </Link>
                    <StatusAcao atendimento={a} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
