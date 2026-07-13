import { useState } from "react";
import {
  useAtualizarRetirada,
  useCriarRetirada,
  useExcluirRetirada,
  useRetiradas,
} from "../../hooks/useRetiradas";
import { mensagemDeErro } from "../../lib/api";
import { formatarData, inicioDaCompetencia, ultimoDiaDoMes } from "../../lib/competencia";
import { formatarPreco } from "../../lib/formato";
import type { Retirada } from "../../lib/types";
import { ErroAoCarregar } from "../ErroAoCarregar";
import { EstadoVazio } from "../EstadoVazio";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Paginacao } from "../ui/Paginacao";
import { RetiradaForm } from "./RetiradaForm";

export function RetiradasSecao({ mes }: { mes: string }) {
  const [pagina, setPagina] = useState(1);
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Retirada | null>(null);

  // Retirada guarda data real, não competência: o mês vira intervalo (invariante 10
  // vale para o lançamento; o recorte é o mesmo que o dashboard usa para somar).
  const { data, isPending, isError, refetch } = useRetiradas(
    inicioDaCompetencia(mes),
    ultimoDiaDoMes(mes),
    pagina,
  );
  const criar = useCriarRetirada();
  const excluir = useExcluirRetirada();

  function fecharCriacao() {
    setCriando(false);
    criar.reset();
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-xl text-escuro">Retiradas</h2>
        <Button onClick={() => setCriando(true)}>Nova retirada</Button>
      </div>

      <div className="mt-4">
        {isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => refetch()} />
        ) : isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : data.count === 0 ? (
          <EstadoVazio
            titulo="Nenhuma retirada neste mês"
            descricao="Registre o pró-labore e as retiradas de lucro da competência."
            acao={<Button onClick={() => setCriando(true)}>Nova retirada</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
                    <th className="px-6 py-3 font-semibold">Descrição</th>
                    <th className="px-2 py-3 font-semibold">Tipo</th>
                    <th className="px-2 py-3 font-semibold">Data</th>
                    <th className="px-2 py-3 font-semibold text-right">Valor</th>
                    <th className="px-6 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((retirada) => (
                    <tr
                      key={retirada.id}
                      className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50"
                    >
                      <td className="px-6 py-4 font-medium text-escuro">{retirada.descricao}</td>
                      <td className="px-2 py-4 text-neutro">{retirada.tipo || "—"}</td>
                      <td className="px-2 py-4 font-mono text-neutro">
                        {formatarData(retirada.data)}
                      </td>
                      <td className="px-2 py-4 text-right font-mono font-semibold text-escuro">
                        {formatarPreco(retirada.valor)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => setEmEdicao(retirada)}>
                            Editar
                          </Button>
                          <Button
                            variant="danger"
                            disabled={excluir.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Excluir esta retirada? A exclusão é permanente e altera o fechamento do mês.",
                                )
                              )
                                excluir.mutate(retirada.id);
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

      <Modal aberto={criando} titulo="Nova retirada" aoFechar={fecharCriacao}>
        <RetiradaForm
          mesPadrao={mes}
          enviando={criar.isPending}
          erro={criar.isError ? mensagemDeErro(criar.error) : undefined}
          aoCancelar={fecharCriacao}
          aoSalvar={(dados) => criar.mutate(dados, { onSuccess: fecharCriacao })}
        />
      </Modal>

      {emEdicao && (
        <ModalEdicao retirada={emEdicao} mes={mes} aoFechar={() => setEmEdicao(null)} />
      )}
    </section>
  );
}

function ModalEdicao({
  retirada,
  mes,
  aoFechar,
}: {
  retirada: Retirada;
  mes: string;
  aoFechar: () => void;
}) {
  const atualizar = useAtualizarRetirada(retirada.id);
  return (
    <Modal aberto titulo="Editar retirada" aoFechar={aoFechar}>
      <RetiradaForm
        inicial={retirada}
        mesPadrao={mes}
        enviando={atualizar.isPending}
        erro={atualizar.isError ? mensagemDeErro(atualizar.error) : undefined}
        aoCancelar={aoFechar}
        aoSalvar={(dados) => atualizar.mutate(dados, { onSuccess: aoFechar })}
      />
    </Modal>
  );
}
