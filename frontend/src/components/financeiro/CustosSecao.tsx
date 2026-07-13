import { useState } from "react";
import {
  useAtualizarCusto,
  useCriarCusto,
  useCustos,
  useExcluirCusto,
} from "../../hooks/useCustos";
import { mensagemDeErro } from "../../lib/api";
import { inicioDaCompetencia } from "../../lib/competencia";
import { formatarPreco } from "../../lib/formato";
import type { Custo, TipoCusto } from "../../lib/types";
import { ErroAoCarregar } from "../ErroAoCarregar";
import { EstadoVazio } from "../EstadoVazio";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Paginacao } from "../ui/Paginacao";
import { Select } from "../ui/Select";
import { CustoForm } from "./CustoForm";

const FILTROS: { valor: TipoCusto | ""; rotulo: string }[] = [
  { valor: "", rotulo: "Todos" },
  { valor: "fixo", rotulo: "Fixo" },
  { valor: "variavel", rotulo: "Variável" },
];

export function CustosSecao({ mes }: { mes: string }) {
  const [tipo, setTipo] = useState<TipoCusto | "">("");
  const [pagina, setPagina] = useState(1);
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Custo | null>(null);

  const { data, isPending, isError, refetch } = useCustos(inicioDaCompetencia(mes), tipo, pagina);
  const criar = useCriarCusto();
  const excluir = useExcluirCusto();

  function fecharCriacao() {
    setCriando(false);
    criar.reset(); // senão o erro da tentativa anterior reaparece no próximo modal
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-xl text-escuro">Custos</h2>
        <div className="flex items-end gap-3">
          <Select
            label="Tipo"
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoCusto | "");
              setPagina(1);
            }}
          >
            {FILTROS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.rotulo}
              </option>
            ))}
          </Select>
          <Button onClick={() => setCriando(true)}>Novo custo</Button>
        </div>
      </div>

      <div className="mt-4">
        {isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => refetch()} />
        ) : isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : data.count === 0 ? (
          <EstadoVazio
            titulo={tipo ? "Nenhum custo deste tipo no mês" : "Nenhum custo neste mês"}
            descricao={
              tipo
                ? "Troque o filtro ou lance um novo custo."
                : "Lance o aluguel, a energia e os insumos da competência."
            }
            acao={<Button onClick={() => setCriando(true)}>Novo custo</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
                    <th className="px-6 py-3 font-semibold">Descrição</th>
                    <th className="px-2 py-3 font-semibold">Tipo</th>
                    <th className="px-2 py-3 font-semibold">Categoria</th>
                    <th className="px-2 py-3 font-semibold text-right">Valor</th>
                    <th className="px-6 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((custo) => (
                    <tr
                      key={custo.id}
                      className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50"
                    >
                      <td className="px-6 py-4 font-medium text-escuro">{custo.descricao}</td>
                      <td className="px-2 py-4">
                        <Badge variant={custo.tipo === "fixo" ? "pendente" : "neutro"}>
                          {custo.tipo === "fixo" ? "Fixo" : "Variável"}
                        </Badge>
                      </td>
                      <td className="px-2 py-4 text-neutro">{custo.categoria || "—"}</td>
                      <td className="px-2 py-4 text-right font-mono font-semibold text-escuro">
                        {formatarPreco(custo.valor)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => setEmEdicao(custo)}>
                            Editar
                          </Button>
                          <Button
                            variant="danger"
                            disabled={excluir.isPending}
                            onClick={() => {
                              // Hard-delete: Custo não tem soft-delete, a linha some
                              // e o fechamento do mês muda. Confirmar é o mínimo.
                              if (
                                window.confirm(
                                  "Excluir este custo? A exclusão é permanente e altera o fechamento do mês.",
                                )
                              )
                                excluir.mutate(custo.id);
                            }}
                          >
                            Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} count={data.count} aoMudar={setPagina} />
          </>
        )}
      </div>

      <Modal aberto={criando} titulo="Novo custo" aoFechar={fecharCriacao}>
        <CustoForm
          mesPadrao={mes}
          enviando={criar.isPending}
          erro={criar.isError ? mensagemDeErro(criar.error) : undefined}
          aoCancelar={fecharCriacao}
          aoSalvar={(dados) => criar.mutate(dados, { onSuccess: fecharCriacao })}
        />
      </Modal>

      {emEdicao && (
        <ModalEdicao custo={emEdicao} mes={mes} aoFechar={() => setEmEdicao(null)} />
      )}
    </section>
  );
}

function ModalEdicao({
  custo,
  mes,
  aoFechar,
}: {
  custo: Custo;
  mes: string;
  aoFechar: () => void;
}) {
  const atualizar = useAtualizarCusto(custo.id);
  return (
    <Modal aberto titulo="Editar custo" aoFechar={aoFechar}>
      <CustoForm
        inicial={custo}
        mesPadrao={mes}
        enviando={atualizar.isPending}
        erro={atualizar.isError ? mensagemDeErro(atualizar.error) : undefined}
        aoCancelar={aoFechar}
        aoSalvar={(dados) => atualizar.mutate(dados, { onSuccess: aoFechar })}
      />
    </Modal>
  );
}
