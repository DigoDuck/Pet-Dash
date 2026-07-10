import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { EstadoVazio } from "../components/EstadoVazio";
import { PetCard } from "../components/clientes/PetCard";
import { PetForm } from "../components/clientes/PetForm";
import { TutorForm } from "../components/clientes/TutorForm";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useCriarPet, usePetsDoTutor } from "../hooks/usePets";
import { useAtualizarTutor, useDesativarTutor, useTutor } from "../hooks/useTutores";

export function TutorDetalhe() {
  const { id } = useParams();
  const tutorId = Number(id);
  const navigate = useNavigate();
  const [editando, setEditando] = useState(false);
  const [novoPet, setNovoPet] = useState(false);

  const tutor = useTutor(tutorId);
  const pets = usePetsDoTutor(tutorId);
  const atualizar = useAtualizarTutor(tutorId);
  const desativar = useDesativarTutor();
  const criarPet = useCriarPet();

  if (tutor.isError) return <ErroAoCarregar aoTentarDeNovo={() => tutor.refetch()} />;
  if (tutor.isPending) return <p className="text-sm text-neutro">Carregando...</p>;

  function aoDesativar() {
    if (!window.confirm("Desativar este tutor? Ele sai das listas, mas o histórico fica.")) return;
    desativar.mutate(tutorId, { onSuccess: () => navigate("/clientes") });
  }

  return (
    <div>
      <nav className="text-xs text-neutro">
        <Link to="/clientes" className="hover:text-marsala">
          Clientes
        </Link>{" "}
        / {tutor.data.nome}
      </nav>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-escuro">{tutor.data.nome}</h1>
          <p className="mt-1 text-sm text-neutro">
            <span className="font-mono">{tutor.data.telefone}</span>
            {tutor.data.email && ` · ${tutor.data.email}`}
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

      <div className="mt-10 flex items-center justify-between gap-4">
        <h2 className="font-display text-xl text-escuro">Pets</h2>
        <Button onClick={() => setNovoPet(true)}>Novo pet</Button>
      </div>

      <div className="mt-4">
        {pets.isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => pets.refetch()} />
        ) : pets.isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : pets.data.count === 0 ? (
          <EstadoVazio
            titulo="Nenhum pet cadastrado"
            descricao="Cadastre o primeiro pet deste tutor."
            acao={<Button onClick={() => setNovoPet(true)}>Novo pet</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pets.data.results.map((pet) => (
              <PetCard key={pet.id} pet={pet} />
            ))}
          </div>
        )}
      </div>

      <Modal aberto={editando} titulo="Editar tutor" aoFechar={() => setEditando(false)}>
        <TutorForm
          inicial={{
            nome: tutor.data.nome,
            telefone: tutor.data.telefone,
            email: tutor.data.email,
          }}
          enviando={atualizar.isPending}
          aoCancelar={() => setEditando(false)}
          aoSalvar={(dados) => atualizar.mutate(dados, { onSuccess: () => setEditando(false) })}
        />
      </Modal>

      <Modal aberto={novoPet} titulo="Novo pet" aoFechar={() => setNovoPet(false)}>
        <PetForm
          tutorId={tutorId}
          enviando={criarPet.isPending}
          aoCancelar={() => setNovoPet(false)}
          aoSalvar={(dados) => criarPet.mutate(dados, { onSuccess: () => setNovoPet(false) })}
        />
      </Modal>
    </div>
  );
}
