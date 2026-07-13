import type { UseQueryResult } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { CustosPorCategoria } from "../components/dashboard/CustosPorCategoria";
import { GraficoMensal } from "../components/dashboard/GraficoMensal";
import { PetsVip } from "../components/dashboard/PetsVip";
import { TopTutores } from "../components/dashboard/TopTutores";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/ui/KpiCard";
import { SeletorMes } from "../components/ui/SeletorMes";
import { useDashboard, useSerieMensal } from "../hooks/useDashboard";
import {
  inicioDaCompetencia,
  mesCorrente,
  mesesAnteriores,
  ultimoDiaDoMes,
} from "../lib/competencia";
import { formatarPercentual, formatarPreco } from "../lib/formato";

const MESES_NO_GRAFICO = 6;

export function Dashboard() {
  const [mes, setMes] = useState(mesCorrente());
  const inicio = inicioDaCompetencia(mes);
  const fim = ultimoDiaDoMes(mes);

  const resumo = useDashboard(inicio, fim);
  // A série termina no mês selecionado, e não em "hoje": um gráfico preso no mês
  // corrente enquanto os KPIs olham junho faria as duas metades da tela falarem de
  // períodos diferentes.
  const primeiroMes = mesesAnteriores(mes, MESES_NO_GRAFICO)[0];
  const serie = useSerieMensal(inicioDaCompetencia(primeiroMes), fim);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Painel financeiro</h1>
        <SeletorMes valor={mes} aoMudar={setMes} />
      </div>

      {/* Os KPIs não somem no erro: o KpiCard mostra "—" e a tela continua de pé. */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          rotulo="Faturamento"
          valor={resumo.data && formatarPreco(resumo.data.faturamento)}
          carregando={resumo.isPending}
          erro={resumo.isError}
        />
        <KpiCard
          rotulo="Custos"
          valor={resumo.data && formatarPreco(resumo.data.custos)}
          carregando={resumo.isPending}
          erro={resumo.isError}
        />
        <KpiCard
          rotulo="Lucro"
          valor={resumo.data && formatarPreco(resumo.data.lucro)}
          sub={resumo.data && `Margem de ${formatarPercentual(resumo.data.margem)}`}
          carregando={resumo.isPending}
          erro={resumo.isError}
        />
        <KpiCard
          rotulo="Ticket médio"
          valor={resumo.data && formatarPreco(resumo.data.ticket_medio)}
          carregando={resumo.isPending}
          erro={resumo.isError}
        />
        <KpiCard
          rotulo="Retiradas"
          valor={resumo.data && formatarPreco(resumo.data.retiradas)}
          carregando={resumo.isPending}
          erro={resumo.isError}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Bloco consulta={serie} rotuloErro="Não foi possível carregar o gráfico.">
            {(pontos) => <GraficoMensal serie={pontos} mesSelecionado={mes} />}
          </Bloco>
        </div>
        <Bloco consulta={resumo} rotuloErro="Não foi possível carregar as despesas.">
          {(dados) => <CustosPorCategoria categorias={dados.custos_por_categoria} />}
        </Bloco>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Bloco consulta={resumo} rotuloErro="Não foi possível carregar os tutores.">
          {(dados) => <TopTutores tutores={dados.top_tutores} />}
        </Bloco>
        <Bloco consulta={resumo} rotuloErro="Não foi possível carregar os pets VIP.">
          {(dados) => <PetsVip pets={dados.vip} />}
        </Bloco>
      </div>
    </div>
  );
}

interface BlocoProps<T> {
  consulta: UseQueryResult<T>;
  rotuloErro: string;
  children: (dados: T) => ReactNode;
}

/** Carregando, erro e conteúdo de um bloco, isolados dos outros: a série falhar não
 *  pode apagar os KPIs, e o erro dos KPIs não pode apagar o gráfico. */
function Bloco<T>({ consulta, rotuloErro, children }: BlocoProps<T>) {
  if (consulta.isError) {
    return <ErroAoCarregar mensagem={rotuloErro} aoTentarDeNovo={() => consulta.refetch()} />;
  }
  if (consulta.isPending) {
    return (
      <Card>
        <p className="text-sm text-neutro">Carregando...</p>
      </Card>
    );
  }
  return <>{children(consulta.data)}</>;
}
