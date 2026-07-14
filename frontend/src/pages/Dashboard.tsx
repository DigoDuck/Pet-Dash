import { useState } from "react";
import { CustosPorCategoria } from "../components/dashboard/CustosPorCategoria";
import { GraficoMensal } from "../components/dashboard/GraficoMensal";
import { HeroFaturamento } from "../components/dashboard/HeroFaturamento";
import { TransacoesRecentes } from "../components/dashboard/TransacoesRecentes";
import { Bloco } from "../components/ui/Bloco";
import { KpiCard } from "../components/ui/KpiCard";
import { SeletorMes } from "../components/ui/SeletorMes";
import { useDashboard, useSerieMensal, useTransacoes } from "../hooks/useDashboard";
import {
  inicioDaCompetencia,
  mesCorrente,
  mesCurto,
  mesesAnteriores,
  ultimoDiaDoMes,
} from "../lib/competencia";
import { formatarPercentual, formatarPreco } from "../lib/formato";
import type { PontoSerie } from "../lib/types";

const MESES_NO_GRAFICO = 6;

interface Crescimento {
  rotulo: string;
  mesAnterior: string;
}

/** Faturamento do último mês da série contra o penúltimo.
 *
 *  Sai de graça da série que o gráfico já carregou — nenhuma query nova. Devolve
 *  `null` quando não há base de comparação: com o mês anterior zerado, a divisão
 *  produziria Infinity, e "+∞%" numa tela financeira é pior do que não mostrar nada. */
function taxaDeCrescimento(serie: PontoSerie[]): Crescimento | null {
  if (serie.length < 2) return null;

  const atual = Number(serie[serie.length - 1].faturamento);
  const anterior = serie[serie.length - 2];
  const base = Number(anterior.faturamento);
  if (base === 0) return null;

  const variacao = (atual - base) / base;
  const sinal = variacao > 0 ? "+" : "";
  return {
    rotulo: `${sinal}${formatarPercentual(variacao)}`,
    mesAnterior: mesCurto(anterior.competencia),
  };
}

export function Dashboard() {
  const [mes, setMes] = useState(mesCorrente());
  const inicio = inicioDaCompetencia(mes);
  const fim = ultimoDiaDoMes(mes);

  const resumo = useDashboard(inicio, fim);
  const transacoes = useTransacoes(inicio, fim);
  // A série termina no mês selecionado, e não em "hoje": um gráfico preso no mês
  // corrente enquanto os KPIs olham junho faria as duas metades da tela falarem de
  // períodos diferentes.
  const primeiroMes = mesesAnteriores(mes, MESES_NO_GRAFICO)[0];
  const serie = useSerieMensal(inicioDaCompetencia(primeiroMes), fim);

  const crescimento = serie.data ? taxaDeCrescimento(serie.data) : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Painel financeiro</h1>
        <SeletorMes valor={mes} aoMudar={setMes} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <HeroFaturamento
            mes={mes}
            faturamento={resumo.data && formatarPreco(resumo.data.faturamento)}
            lucro={resumo.data && formatarPreco(resumo.data.lucro)}
            margem={resumo.data && formatarPercentual(resumo.data.margem)}
            carregando={resumo.isPending}
            erro={resumo.isError}
          />
        </div>

        {/* Os KPIs não somem no erro: o KpiCard mostra "—" e a tela continua de pé. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
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
            sub="Por venda, não por visita"
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
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Bloco consulta={serie} rotuloErro="Não foi possível carregar o gráfico.">
            {(pontos) => <GraficoMensal serie={pontos} mesSelecionado={mes} />}
          </Bloco>
        </div>
        <div className="lg:col-span-4">
          <Bloco consulta={resumo} rotuloErro="Não foi possível carregar as despesas.">
            {(dados) => <CustosPorCategoria categorias={dados.custos_por_categoria} />}
          </Bloco>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Bloco consulta={transacoes} rotuloErro="Não foi possível carregar as movimentações.">
            {(lista) => <TransacoesRecentes transacoes={lista} />}
          </Bloco>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-4 lg:grid-cols-1">
          <KpiCard
            rotulo="Atendimentos"
            valor={resumo.data && String(resumo.data.qtd_atendimentos)}
            sub="Visitas liberadas no mês"
            carregando={resumo.isPending}
            erro={resumo.isError}
          />
          <KpiCard
            rotulo="Pets ativos"
            valor={resumo.data && String(resumo.data.pets_ativos)}
            sub="No cadastro, não no mês"
            carregando={resumo.isPending}
            erro={resumo.isError}
          />
          <KpiCard
            rotulo="Crescimento"
            // Sem base de comparação o card mostra "—". O `carregando` cobre o tempo
            // da série; depois disso, ausência de crescimento é um fato, não um erro.
            valor={crescimento ? crescimento.rotulo : serie.isSuccess ? "—" : undefined}
            sub={crescimento ? `Faturamento vs ${crescimento.mesAnterior}` : undefined}
            carregando={serie.isPending}
            erro={serie.isError}
          />
        </div>
      </div>
    </div>
  );
}
