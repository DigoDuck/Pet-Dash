import { useState } from "react";
import { CustosSecao } from "../components/financeiro/CustosSecao";
import { ResumoMes } from "../components/financeiro/ResumoMes";
import { RetiradasSecao } from "../components/financeiro/RetiradasSecao";
import { Input } from "../components/ui/Input";
import { inicioDaCompetencia, mesCorrente, ultimoDiaDoMes } from "../lib/competencia";

const MES_VALIDO = /^\d{4}-\d{2}$/;

/** A página só decide o mês; cada seção cuida do próprio estado (página, modais,
 *  filtro). Sem essa divisão, ela acumularia o estado das duas tabelas. */
export function Financeiro() {
  const [mes, setMes] = useState(mesCorrente());

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Financeiro</h1>
        {/* O input type="month" pode ser esvaziado (botão de limpar do navegador),
            e "" derrubaria a tela: ultimoDiaDoMes("") vira Invalid Date e o
            toISOString() estoura RangeError. Mês incompleto é ignorado; o campo
            é controlado, então ele volta sozinho ao último mês válido. */}
        <Input
          label="Mês"
          type="month"
          value={mes}
          onChange={(e) => {
            if (MES_VALIDO.test(e.target.value)) setMes(e.target.value);
          }}
        />
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
