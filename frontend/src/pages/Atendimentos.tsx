import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AtendimentoTabela } from "../components/atendimentos/AtendimentoTabela";
import { FiltrosAtendimento } from "../components/atendimentos/FiltrosAtendimento";
import { EstadoVazio } from "../components/EstadoVazio";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { Button } from "../components/ui/Button";
import { Paginacao } from "../components/ui/Paginacao";
import { useAtendimentos } from "../hooks/useAtendimentos";

export function Atendimentos() {
  const navigate = useNavigate();
  const [data, setData] = useState("");
  const [status, setStatus] = useState("");
  const [pagina, setPagina] = useState(1);

  const { data: resp, isPending, isError, refetch } = useAtendimentos({
    data, status, pet: null, pagina,
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Atendimentos</h1>
        <Button onClick={() => navigate("/atendimentos/novo")}>Novo atendimento</Button>
      </div>

      <div className="mt-6">
        <FiltrosAtendimento
          data={data}
          status={status}
          aoMudarData={(v) => { setData(v); setPagina(1); }}
          aoMudarStatus={(v) => { setStatus(v); setPagina(1); }}
        />
      </div>

      <div className="mt-6">
        {isError ? (
          <ErroAoCarregar aoTentarDeNovo={() => refetch()} />
        ) : isPending ? (
          <p className="text-sm text-neutro">Carregando...</p>
        ) : resp.count === 0 ? (
          // Com filtro, o vazio é do filtro, não do spa: "registre o primeiro" ali
          // sugeria que os atendimentos tinham sumido.
          data || status ? (
            <EstadoVazio
              titulo="Nenhum atendimento com esses filtros"
              descricao="Troque a data ou escolha Todos em Situação."
            />
          ) : (
            <EstadoVazio
              titulo="Nenhum atendimento"
              descricao="Registre o primeiro atendimento do spa."
              acao={<Button onClick={() => navigate("/atendimentos/novo")}>Novo atendimento</Button>}
            />
          )
        ) : (
          <>
            <AtendimentoTabela atendimentos={resp.results} />
            <Paginacao pagina={pagina} count={resp.count} aoMudar={setPagina} />
          </>
        )}
      </div>
    </div>
  );
}
