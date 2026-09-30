import { useSearchParams } from "react-router-dom";
import { mesCorrente } from "../lib/competencia";

/** O mês da tela guardado em `?mes=2026-06`, e não num `useState`.
 *
 *  Cada página tinha o próprio estado começando no mês corrente: ela revisava junho no
 *  Painel, tocava "Ver custos" e caía nos custos de setembro, sem aviso. Na URL, o mês
 *  viaja no link, sobrevive ao recarregar e ao voltar do navegador. `replace` para não
 *  empilhar uma entrada de histórico a cada clique na seta do mês. */
export function useMesDaUrl(): [string, (mes: string) => void] {
  const [params, setParams] = useSearchParams();
  const salvo = params.get("mes");
  const mes = salvo && /^\d{4}-\d{2}$/.test(salvo) ? salvo : mesCorrente();

  function setMes(novo: string) {
    setParams(
      (atuais) => {
        const proximos = new URLSearchParams(atuais);
        proximos.set("mes", novo);
        return proximos;
      },
      { replace: true },
    );
  }

  return [mes, setMes];
}
