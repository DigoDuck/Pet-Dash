import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatarData } from "../../lib/competencia";
import { textoSaldo } from "../../lib/formato";
import type { Pacote } from "../../lib/types";

interface OrigemAtendimentoProps {
  /** O pacote que vale na data do banho (ou null: nenhum cobre a data). */
  pacote: Pacote | null;
  usaPacote: boolean;
  nomePet: string;
  /** Data do banho, ISO. É ela que decide qual pacote vale. */
  data: string;
  aoCobrarAvulso: () => void;
  aoUsarPacote: () => void;
}

/** Diz SEMPRE de onde sai o dinheiro deste banho: do pacote ou avulso.
 *
 *  Antes só o caso "tem pacote" tinha aviso; sem pacote, o banho virava avulso calado e
 *  a Patricia só descobria no fim do mês. Era a queixa dela: "achei que ia sair do
 *  pacote e virou avulso". Cada estado explica o porquê e, quando dá, o caminho de volta.
 *
 *  `role="status"`: trocar o pet ou a data muda a origem, e o leitor de tela anuncia. */
export function OrigemAtendimento({
  pacote,
  usaPacote,
  nomePet,
  data,
  aoCobrarAvulso,
  aoUsarPacote,
}: OrigemAtendimentoProps) {
  if (pacote && usaPacote) {
    return (
      <Caixa
        tom="pacote"
        titulo={`Sai do pacote de ${nomeDoMes(pacote.competencia)}`}
        acao={<Acao onClick={aoCobrarAvulso}>Cobrar como avulso</Acao>}
      >
        {textoSaldo(pacote.saldo, pacote.qtd_total)} · este banho usa 1 crédito · vale até{" "}
        {formatarData(pacote.validade)}
      </Caixa>
    );
  }

  if (pacote && pacote.saldo > 0) {
    return (
      <Caixa
        tom="avulso"
        titulo="Cobrado como avulso"
        acao={<Acao onClick={aoUsarPacote}>Usar o pacote</Acao>}
      >
        Por escolha sua. O pacote de {nomePet} continua com{" "}
        {textoSaldo(pacote.saldo, pacote.qtd_total)}.
      </Caixa>
    );
  }

  if (pacote) {
    return (
      <Caixa tom="avulso" titulo="Cobrado como avulso">
        O pacote de {nomePet} já usou os {pacote.qtd_total} créditos (vale até{" "}
        {formatarData(pacote.validade)}). Banhos pendentes também seguram crédito.
      </Caixa>
    );
  }

  return (
    <Caixa tom="avulso" titulo="Cobrado como avulso">
      {nomePet} não tem pacote valendo em {formatarData(data)}. Se o pacote foi vendido hoje,{" "}
      <Link to="/pacotes" className="font-medium text-marsala underline-offset-2 hover:underline">
        registre a venda em Pacotes
      </Link>{" "}
      antes deste banho.
    </Caixa>
  );
}

/** "2026-09-01" -> "setembro". Com um pacote estendido e o do mês seguinte valendo na
 *  mesma data, é o mês que diz de qual cota sai o crédito. */
function nomeDoMes(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    timeZone: "UTC",
  });
}

function Caixa({
  tom,
  titulo,
  acao,
  children,
}: {
  tom: "pacote" | "avulso";
  titulo: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  const cor =
    tom === "pacote" ? "border-ouro/50 bg-ouro/10" : "border-neutro-light bg-neutro-light/20";
  return (
    // Em coluna no celular: lado a lado em 360px, o texto e o "Cobrar como avulso"
    // se espremiam.
    <div
      role="status"
      className={`flex flex-col items-start gap-2 rounded-lg border p-4 sm:flex-row sm:justify-between sm:gap-4 ${cor}`}
    >
      <div className="text-sm">
        <p className="font-medium text-escuro">{titulo}</p>
        <p className="mt-0.5 text-escuro-suave">{children}</p>
      </div>
      {acao}
    </div>
  );
}

function Acao({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded text-sm font-medium text-marsala hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ouro pointer-coarse:min-h-11"
    >
      {children}
    </button>
  );
}
