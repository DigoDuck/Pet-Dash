import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { EstadoVazio } from "../components/EstadoVazio";
import { TutorForm } from "../components/clientes/TutorForm";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Paginacao } from "../components/ui/Paginacao";
import { useCriarTutor, useTutores } from "../hooks/useTutores";

export function Clientes() {
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);

  // Debounce: sem isto, cada tecla vira um request. keepPreviousData segura a
  // lista anterior na tela enquanto o novo termo carrega.
  useEffect(() => {
    const id = setTimeout(() => {
      setBusca(texto);
      setPagina(1);
    }, 300);
    return () => clearTimeout(id);
  }, [texto]);

  const { data, isPending, isError, refetch } = useTutores(busca, pagina);
  const criar = useCriarTutor();

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Clientes</h1>
        <Button onClick={() => setModalAberto(true)}>Novo tutor</Button>
      </div>

      <div className="mt-6 max-w-sm">
        <Input
          label="Buscar por nome ou telefone"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ana, 71988..."
        />
      </div>

      <div className="mt-6">
        {isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => refetch()} />
        ) : isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : data.count === 0 ? (
          <EstadoVazio
            titulo={busca ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
            descricao={
              busca
                ? "Tente outro nome ou telefone."
                : "Cadastre o primeiro tutor para começar."
            }
            acao={
              busca ? undefined : <Button onClick={() => setModalAberto(true)}>Novo tutor</Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-neutro-light/60 bg-creme">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] tracking-[0.12em] text-neutro uppercase">
                    <th className="px-6 py-3 font-semibold">Tutor</th>
                    <th className="px-2 py-3 font-semibold">Telefone</th>
                    <th className="px-6 py-3 font-semibold">E-mail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((tutor) => (
                    <tr
                      key={tutor.id}
                      className="border-t border-neutro-light/60 transition-colors hover:bg-creme/50"
                    >
                      <td className="px-6 py-4">
                        <Link to={`/clientes/${tutor.id}`} className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-marsala font-semibold text-creme">
                            {tutor.nome.charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium text-escuro">{tutor.nome}</span>
                        </Link>
                      </td>
                      <td className="px-2 py-4 font-mono text-neutro">{tutor.telefone}</td>
                      <td className="px-6 py-4 text-neutro">{tutor.email || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} count={data.count} aoMudar={setPagina} />
          </>
        )}
      </div>

      <Modal aberto={modalAberto} titulo="Novo tutor" aoFechar={() => setModalAberto(false)}>
        <TutorForm
          enviando={criar.isPending}
          aoCancelar={() => setModalAberto(false)}
          aoSalvar={(dados) =>
            criar.mutate(dados, { onSuccess: () => setModalAberto(false) })
          }
        />
      </Modal>
    </div>
  );
}
