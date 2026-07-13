import { useState } from "react";
import { CustosSecao } from "../components/financeiro/CustosSecao";
import { ResumoMes } from "../components/financeiro/ResumoMes";
import { RetiradasSecao } from "../components/financeiro/RetiradasSecao";
import { SeletorMes } from "../components/ui/SeletorMes";
import { inicioDaCompetencia, mesCorrente, ultimoDiaDoMes } from "../lib/competencia";

/** A página só decide o mês; cada seção cuida do próprio estado (página, modais,
 *  filtro). Sem essa divisão, ela acumularia o estado das duas tabelas. */
export function Financeiro() {
  const [mes, setMes] = useState(mesCorrente());

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Financeiro</h1>
        <SeletorMes valor={mes} aoMudar={setMes} />
      </div>

      <div className="mt-6">
        <ResumoMes inicio={inicioDaCompetencia(mes)} fim={ultimoDiaDoMes(mes)} />
      </div>

      <div className="mt-10">
        <CustosSecao mes={mes} />
      </div>

      <div className="mt-12">
        <RetiradasSecao mes={mes} />
      </div>
    </div>
  );
}
