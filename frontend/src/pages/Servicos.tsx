import { useEffect, useState } from "react";
import { EstadoVazio } from "../components/EstadoVazio";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { ServicoForm } from "../components/servicos/ServicoForm";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Checkbox } from "../components/ui/Checkbox";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Paginacao } from "../components/ui/Paginacao";
import { useAtualizarServico, useCriarServico, useServicos } from "../hooks/useServicos";
import { formatarPreco } from "../lib/formato";
import type { Servico } from "../lib/types";

export function Servicos() {
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Servico | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setBusca(texto);
      setPagina(1);
    }, 300);
    return () => clearTimeout(id);
  }, [texto]);

  const { data, isPending, isError, refetch } = useServicos(busca, incluirInativos);
  const criar = useCriarServico();

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Serviços</h1>
        <Button onClick={() => setCriando(true)}>Novo serviço</Button>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-sm flex-1">
          <Input
            label="Buscar por nome"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Banho, pacote..."
          />
        </div>
        <Checkbox
          label="Mostrar inativos"
          checked={incluirInativos}
          onChange={(e) => {
            setIncluirInativos(e.target.checked);
            setPagina(1);
          }}
        />
      </div>

      <div className="mt-6">
        {isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => refetch()} />
        ) : isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : data.count === 0 ? (
          <EstadoVazio
            titulo={busca ? "Nenhum serviço encontrado" : "Nenhum serviço ainda"}
            descricao={
              busca ? "Tente outro nome." : "Cadastre o primeiro serviço do catálogo."
            }
            acao={busca ? undefined : <Button onClick={() => setCriando(true)}>Novo serviço</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
                    <th className="px-6 py-3 font-semibold">Serviço</th>
                    <th className="px-2 py-3 font-semibold">Tipo</th>
                    <th className="px-2 py-3 font-semibold text-right">Preço</th>
                    <th className="px-6 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((servico) => (
                    <tr
                      key={servico.id}
                      className={`border-t border-neutro-light/60 transition-colors hover:bg-creme/50 ${
                        servico.ativo ? "" : "opacity-50"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <span className="font-medium text-escuro">{servico.nome}</span>
                        {!servico.ativo && (
                          <Badge variant="neutro" className="ml-2">
                            Inativo
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-4">
                        <Badge variant={servico.is_pacote ? "vip" : "pendente"}>
                          {servico.is_pacote ? `Pacote · ${servico.creditos} créditos` : "Avulso"}
                        </Badge>
                      </td>
                      <td className="px-2 py-4 text-right font-mono font-semibold text-escuro">
                        {formatarPreco(servico.preco_padrao)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => setEmEdicao(servico)}>
                            Editar
                          </Button>
                          <AlternarAtivo servico={servico} />
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

      <Modal aberto={criando} titulo="Novo serviço" aoFechar={() => setCriando(false)}>
        <ServicoForm
          enviando={criar.isPending}
          aoCancelar={() => setCriando(false)}
          aoSalvar={(dados) => criar.mutate(dados, { onSuccess: () => setCriando(false) })}
        />
      </Modal>

      {emEdicao && <ModalEdicao servico={emEdicao} aoFechar={() => setEmEdicao(null)} />}
    </div>
  );
}

function AlternarAtivo({ servico }: { servico: Servico }) {
  const atualizar = useAtualizarServico(servico.id);
  if (servico.ativo) {
    return (
      <Button
        variant="danger"
        disabled={atualizar.isPending}
        onClick={() => {
          if (window.confirm("Desativar este serviço? Ele sai do catálogo, mas o histórico fica."))
            atualizar.mutate({ ativo: false });
        }}
      >
        Desativar
      </Button>
    );
  }
  return (
    <Button
      variant="secondary"
      disabled={atualizar.isPending}
      onClick={() => atualizar.mutate({ ativo: true })}
    >
      Reativar
    </Button>
  );
}

function ModalEdicao({ servico, aoFechar }: { servico: Servico; aoFechar: () => void }) {
  const atualizar = useAtualizarServico(servico.id);
  return (
    <Modal aberto titulo="Editar serviço" aoFechar={aoFechar}>
      <ServicoForm
        inicial={{
          nome: servico.nome,
          preco_padrao: servico.preco_padrao,
          is_pacote: servico.is_pacote,
          creditos: servico.creditos,
        }}
        enviando={atualizar.isPending}
        aoCancelar={aoFechar}
        aoSalvar={(dados) => atualizar.mutate(dados, { onSuccess: aoFechar })}
      />
    </Modal>
  );
}
