import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { EstadoVazio } from "../components/EstadoVazio";
import { HistoricoTabela } from "../components/clientes/HistoricoTabela";
import { PetForm } from "../components/clientes/PetForm";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Paginacao } from "../components/ui/Paginacao";
import { useAtendimentosDoPet } from "../hooks/useAtendimentos";
import { useAtualizarPet, useDesativarPet, usePet } from "../hooks/usePets";

const ROTULOS_PORTE: Record<string, string> = {
  "": "Porte não informado",
  P: "Pequeno",
  M: "Médio",
  G: "Grande",
};

export function PetDetalhe() {
  const { id } = useParams();
  const petId = Number(id);
  const navigate = useNavigate();
  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState(false);

  const pet = usePet(petId);
  const historico = useAtendimentosDoPet(petId, pagina);
  const atualizar = useAtualizarPet(petId);
  const desativar = useDesativarPet();

  if (pet.isError) return <ErroAoCarregar aoTentarDeNovo={() => pet.refetch()} />;
  if (pet.isPending) return <p className="text-sm text-neutro">Carregando...</p>;

  // Captura após os guards: dentro do closure de onSuccess o TS descartaria o
  // narrowing de pet.data (função aninhada não herda o control-flow acima).
  const tutorDoPet = pet.data.tutor;

  function aoDesativar() {
    if (!window.confirm("Desativar este pet? Ele sai das listas, mas o histórico fica.")) return;
    desativar.mutate(petId, { onSuccess: () => navigate(`/clientes/${tutorDoPet}`) });
  }

  return (
    <div>
      <nav className="text-xs text-neutro">
        <Link to="/clientes" className="hover:text-marsala">
          Clientes
        </Link>{" "}
        /{" "}
        <Link to={`/clientes/${pet.data.tutor}`} className="hover:text-marsala">
          {pet.data.tutor_nome}
        </Link>{" "}
        / {pet.data.nome}
      </nav>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl text-escuro">{pet.data.nome}</h1>
            {pet.data.vip && <Badge variant="vip">VIP</Badge>}
          </div>
          <p className="mt-1 text-sm text-neutro">
            {pet.data.raca || "Sem raça definida"} · {ROTULOS_PORTE[pet.data.porte]} ·{" "}
            <span className="font-mono">{pet.data.qtd_visitas}</span> visitas nos últimos 12 meses
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditando(true)}>
            Editar
          </Button>
          <Button variant="danger" onClick={aoDesativar} disabled={desativar.isPending}>
            Desativar
          </Button>
        </div>
      </div>

      <h2 className="mt-10 font-display text-xl text-escuro">Histórico de atendimentos</h2>

      <div className="mt-4">
        {historico.isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => historico.refetch()} />
        ) : historico.isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : historico.data.count === 0 ? (
          <EstadoVazio
            titulo="Nenhum atendimento ainda"
            descricao="Os atendimentos deste pet aparecem aqui."
          />
        ) : (
          <>
            <HistoricoTabela atendimentos={historico.data.results} />
            <Paginacao pagina={pagina} count={historico.data.count} aoMudar={setPagina} />
          </>
        )}
      </div>

      <Modal aberto={editando} titulo="Editar pet" aoFechar={() => setEditando(false)}>
        <PetForm
          tutorId={pet.data.tutor}
          inicial={{ nome: pet.data.nome, raca: pet.data.raca, porte: pet.data.porte }}
          enviando={atualizar.isPending}
          aoCancelar={() => setEditando(false)}
          aoSalvar={(dados) => atualizar.mutate(dados, { onSuccess: () => setEditando(false) })}
        />
      </Modal>
    </div>
  );
}
