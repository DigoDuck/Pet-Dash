import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  /** Rótulo do botão que executa a ação: "Excluir", "Desativar", "Cancelar atendimento". */
  rotuloConfirmar: string;
  enviando?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

/** Confirmação de ação destrutiva dentro da página.
 *
 *  Substitui o `window.confirm`, que no Firefox da Patricia simplesmente não
 *  aparecia. O modo de falha é o pior possível: um `confirm()` suprimido pelo
 *  navegador devolve `false`, então o botão Excluir virava um botão que não faz
 *  nada — sem diálogo, sem erro, sem pista. Um diálogo do próprio app não depende
 *  de permissão de navegador.
 *
 *  O botão que desiste é "Voltar", e não "Cancelar": em "Cancelar este
 *  atendimento?" os dois botões se chamariam Cancelar e um deles faria o
 *  contrário do que diz. */
export function Confirmacao({
  aberto,
  titulo,
  mensagem,
  rotuloConfirmar,
  enviando = false,
  aoConfirmar,
  aoCancelar,
}: ConfirmacaoProps) {
  return (
    <Modal aberto={aberto} titulo={titulo} aoFechar={aoCancelar}>
      <p className="text-sm text-neutro">{mensagem}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={aoCancelar}>
          Voltar
        </Button>
        <Button type="button" variant="danger" disabled={enviando} onClick={aoConfirmar}>
          {enviando ? "Aguarde..." : rotuloConfirmar}
        </Button>
      </div>
    </Modal>
  );
}
