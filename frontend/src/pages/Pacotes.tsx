import { useEffect, useState } from "react";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { EstadoVazio } from "../components/EstadoVazio";
import { PacoteForm } from "../components/pacotes/PacoteForm";
import { SaldoBadge } from "../components/pacotes/SaldoBadge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Paginacao } from "../components/ui/Paginacao";
import { useAtualizarPacote, useCriarPacote, usePacotes } from "../hooks/usePacotes";
import { mensagemDeErro } from "../lib/api";
import { formatarData, inicioDaCompetencia, mesCorrente } from "../lib/competencia";
import type { Pacote } from "../lib/types";

function formatarPreco(valor: string): string {
  return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
}

export function Pacotes() {
  const [mes, setMes] = useState(mesCorrente());
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [vendendo, setVendendo] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Pacote | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setBusca(texto);
      setPagina(1);
    }, 300);
    return () => clearTimeout(id);
  }, [texto]);

  const { data, isPending, isError, refetch } = usePacotes(
    inicioDaCompetencia(mes),
    busca,
    pagina,
  );
  const criar = useCriarPacote();

  function fecharVenda() {
    setVendendo(false);
    criar.reset(); // senão o erro da tentativa anterior reaparece no próximo modal
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Pacotes</h1>
        <Button onClick={() => setVendendo(true)}>Vender pacote</Button>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        {/* Rótulo "Mês", não "Competência": o campo do modal já usa esse nome, e
            dois rótulos iguais na tela deixariam o leitor de tela ambíguo. */}
        <Input
          label="Mês"
          type="month"
          value={mes}
          onChange={(e) => {
            setMes(e.target.value);
            setPagina(1);
          }}
        />
        <div className="max-w-sm flex-1">
          <Input
            label="Buscar por pet ou tutor"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Luna, Ana..."
          />
        </div>
      </div>

      <div className="mt-6">
        {isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => refetch()} />
        ) : isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : data.count === 0 ? (
          <EstadoVazio
            titulo={busca ? "Nenhum pacote encontrado" : "Nenhum pacote neste mês"}
            descricao={
              busca
                ? "Tente outro nome de pet ou tutor."
                : "Venda o primeiro Pacote Fidelidade da competência."
            }
            acao={
              busca ? undefined : <Button onClick={() => setVendendo(true)}>Vender pacote</Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
                    <th className="px-6 py-3 font-semibold">Pet</th>
                    <th className="px-2 py-3 font-semibold">Serviço</th>
                    <th className="px-2 py-3 font-semibold">Saldo</th>
                    <th className="px-2 py-3 font-semibold text-right">Valor pago</th>
                    <th className="px-2 py-3 font-semibold">Validade</th>
                    <th className="px-6 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50"
                    >
                      <td className="px-6 py-4">
                        <span className="font-medium text-escuro">{p.pet_nome}</span>
                        <span className="block text-xs text-neutro">{p.tutor_nome}</span>
                      </td>
                      <td className="px-2 py-4 text-escuro">{p.servico_nome}</td>
                      <td className="px-2 py-4">
                        <SaldoBadge saldo={p.saldo} total={p.qtd_total} />
                      </td>
                      <td className="px-2 py-4 text-right font-mono font-semibold text-escuro">
                        {formatarPreco(p.valor_pago)}
                      </td>
                      <td className="px-2 py-4 font-mono text-neutro">{formatarData(p.validade)}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <Button variant="ghost" onClick={() => setEmEdicao(p)}>
                            Editar
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

      <Modal aberto={vendendo} titulo="Vender pacote" aoFechar={fecharVenda}>
        <PacoteForm
          enviando={criar.isPending}
          erro={criar.isError ? mensagemDeErro(criar.error) : undefined}
          aoCancelar={fecharVenda}
          aoSalvar={(dados) => criar.mutate(dados, { onSuccess: fecharVenda })}
        />
      </Modal>

      {emEdicao && <ModalEdicao pacote={emEdicao} aoFechar={() => setEmEdicao(null)} />}
    </div>
  );
}

function ModalEdicao({ pacote, aoFechar }: { pacote: Pacote; aoFechar: () => void }) {
  const atualizar = useAtualizarPacote(pacote.id);
  return (
    <Modal aberto titulo="Editar pacote" aoFechar={aoFechar}>
      <PacoteForm
        inicial={pacote}
        enviando={atualizar.isPending}
        erro={atualizar.isError ? mensagemDeErro(atualizar.error) : undefined}
        aoCancelar={aoFechar}
        aoSalvar={(dados) => atualizar.mutate(dados, { onSuccess: aoFechar })}
      />
    </Modal>
  );
}
