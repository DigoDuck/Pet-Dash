import { useEffect, useState } from "react";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { EstadoVazio } from "../components/EstadoVazio";
import { PetsVip } from "../components/clientes/PetsVip";
import { TabelaPets } from "../components/clientes/TabelaPets";
import { TabelaTutores } from "../components/clientes/TabelaTutores";
import { TopTutores } from "../components/clientes/TopTutores";
import { TutorForm } from "../components/clientes/TutorForm";
import { Bloco } from "../components/ui/Bloco";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Paginacao } from "../components/ui/Paginacao";
import { useDashboard } from "../hooks/useDashboard";
import { usePets } from "../hooks/usePets";
import { useCriarTutor, useTutores } from "../hooks/useTutores";
import { inicioDaCompetencia, mesCorrente, ultimoDiaDoMes } from "../lib/competencia";

type Aba = "tutores" | "pets";

export function Clientes() {
  const [aba, setAba] = useState<Aba>("tutores");
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

  const tutores = useTutores(busca, pagina, aba === "tutores");
  const pets = usePets(busca, pagina, aba === "pets");
  const criar = useCriarTutor();

  // Mesma chave que o Dashboard usa no mês corrente: a resposta vem do cache, sem
  // request novo, se a Patricia passou pelo painel antes de abrir os clientes.
  const mes = mesCorrente();
  const destaques = useDashboard(inicioDaCompetencia(mes), ultimoDiaDoMes(mes));

  // A busca não sobrevive à troca de aba: em Tutores ela casa nome+telefone do dono, em
  // Pets casa nome do pet + nome do dono. Levar o termo junto devolve "nada encontrado"
  // sem dizer por quê.
  function trocarAba(nova: Aba) {
    setAba(nova);
    setTexto("");
    setBusca("");
    setPagina(1);
  }

  const consulta = aba === "tutores" ? tutores : pets;
  const rotuloBusca =
    aba === "tutores" ? "Buscar por nome ou telefone" : "Buscar por nome do pet ou tutor";

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Clientes</h1>
        {/* Continua "Novo tutor" nas duas abas: pet só existe dentro de um dono, e a
            criação vive na ficha do tutor, onde o dono já está definido. */}
        <Button onClick={() => setModalAberto(true)}>Novo tutor</Button>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-sm grow">
          <Input
            label={rotuloBusca}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={aba === "tutores" ? "Ana, 71988..." : "Thor, Ana..."}
          />
        </div>
        <div className="flex rounded-lg border border-neutro-light/60 p-0.5" role="group">
          {(["tutores", "pets"] as const).map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => trocarAba(valor)}
              aria-pressed={aba === valor}
              // ~30px sem o piso de toque, e é o controle que troca a aba inteira.
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors pointer-coarse:min-h-11 ${
                aba === valor ? "bg-marsala text-creme" : "text-neutro hover:text-escuro"
              }`}
            >
              {valor === "tutores" ? "Tutores" : "Pets"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {consulta.isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => consulta.refetch()} />
        ) : consulta.isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : consulta.data.count === 0 ? (
          <EstadoVazio
            titulo={
              busca
                ? aba === "tutores"
                  ? "Nenhum cliente encontrado"
                  : "Nenhum pet encontrado"
                : aba === "tutores"
                  ? "Nenhum cliente ainda"
                  : "Nenhum pet ainda"
            }
            descricao={
              busca
                ? "Tente outro nome."
                : aba === "tutores"
                  ? "Cadastre o primeiro tutor para começar."
                  : "Os pets aparecem aqui depois de cadastrados na ficha do tutor."
            }
            acao={
              busca || aba === "pets" ? undefined : (
                <Button onClick={() => setModalAberto(true)}>Novo tutor</Button>
              )
            }
          />
        ) : (
          <>
            {aba === "tutores" ? (
              <TabelaTutores tutores={tutores.data!.results} />
            ) : (
              <TabelaPets pets={pets.data!.results} />
            )}
            <Paginacao pagina={pagina} count={consulta.data.count} aoMudar={setPagina} />
          </>
        )}
      </div>

      {/* Top tutores por gasto ao lado do VIP por pet: é a mitigação do ponto cego da
          invariante 6 (tutor com vários pets abaixo do limite nunca vira VIP sozinho).
          Vive aqui, e não no painel financeiro, porque a pergunta é sobre gente. */}
      <section className="mt-12">
        <h2 className="font-display text-2xl text-escuro">Destaques do mês</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <Bloco consulta={destaques} rotuloErro="Não foi possível carregar os tutores.">
            {(dados) => <TopTutores tutores={dados.top_tutores} />}
          </Bloco>
          <Bloco consulta={destaques} rotuloErro="Não foi possível carregar os pets VIP.">
            {(dados) => <PetsVip pets={dados.vip} />}
          </Bloco>
        </div>
      </section>

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
