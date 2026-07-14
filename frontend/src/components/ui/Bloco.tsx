import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErroAoCarregar } from "../ErroAoCarregar";
import { Card } from "./Card";

interface BlocoProps<T> {
  consulta: UseQueryResult<T>;
  rotuloErro: string;
  children: (dados: T) => ReactNode;
}

/** Carregando, erro e conteúdo de um bloco, isolados dos vizinhos: a série falhar não
 *  pode apagar os KPIs, e o erro dos KPIs não pode apagar o gráfico. */
export function Bloco<T>({ consulta, rotuloErro, children }: BlocoProps<T>) {
  if (consulta.isError) {
    return <ErroAoCarregar mensagem={rotuloErro} aoTentarDeNovo={() => consulta.refetch()} />;
  }
  if (consulta.isPending) {
    return <Esqueleto />;
  }
  return <>{children(consulta.data)}</>;
}

/** Esqueleto no lugar de "Carregando...": a caixa já ocupa a altura final, então o
 *  conteúdo não empurra o resto da página quando chega. `motion-reduce` desliga o
 *  pulso para quem pediu menos animação — o bloco continua visível, só parado. */
function Esqueleto() {
  return (
    <Card aria-busy="true">
      <span className="sr-only">Carregando</span>
      <div className="animate-pulse space-y-3 motion-reduce:animate-none" aria-hidden="true">
        <div className="h-4 w-1/3 rounded bg-neutro-light/60" />
        <div className="h-32 rounded bg-neutro-light/40" />
        <div className="h-4 w-2/3 rounded bg-neutro-light/60" />
      </div>
    </Card>
  );
}
