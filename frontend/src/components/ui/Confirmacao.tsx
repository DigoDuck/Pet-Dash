import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  /** Rótulo do botão que executa a ação: "Excluir", "Desativar", "Cancelar atendimento". */
  rotuloConfirmar: string;
  enviando?: boolean;
  /** Mensagem de recusa da ação. Passar isto é o que mantém o diálogo aberto ao
   *  falhar: quem confirma fecha no `onSuccess`, nunca no `onSettled`. */
  erro?: string;
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
 *  contrário do que diz.
 *
 *  A recusa aparece DENTRO do diálogo, no lugar onde ela clicou. Fora dele o
 *  alerta sobrevive à ação que o gerou: some da vista quando ela rola a tabela,
 *  não limpa ao trocar de mês, e vira um erro vermelho sobre coisa nenhuma. */
export function Confirmacao({
  aberto,
  titulo,
  mensagem,
  rotuloConfirmar,
  enviando = false,
  erro,
  aoConfirmar,
  aoCancelar,
}: ConfirmacaoProps) {
  return (
    <Modal aberto={aberto} titulo={titulo} aoFechar={aoCancelar}>
      <p className="text-sm text-neutro">{mensagem}</p>
      {erro && (
        <p role="alert" className="mt-4 rounded-lg bg-erro/10 px-3 py-2 text-sm text-erro">
          {erro}
        </p>
      )}
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
