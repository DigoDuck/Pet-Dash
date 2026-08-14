import { useState } from "react";
import type { Atendimento } from "../../lib/types";
import { useAtualizarAtendimento } from "../../hooks/useAtendimentos";
import { mensagemDeErro } from "../../lib/api";
import { Button } from "../ui/Button";
import { Confirmacao } from "../ui/Confirmacao";

export function StatusAcao({ atendimento }: { atendimento: Atendimento }) {
  const atualizar = useAtualizarAtendimento(atendimento.id);
  const [confirmando, setConfirmando] = useState(false);

  if (atendimento.status === "Cancelado") {
    return <span className="text-xs text-neutro">—</span>;
  }

  return (
    <div className="flex flex-col items-end gap-2 md:flex-row md:justify-end">
      {atendimento.status === "Pendente" && (
        <Button
          variant="secondary"
          disabled={atualizar.isPending}
          onClick={() => atualizar.mutate({ status: "Liberado" })}
        >
          Liberar
        </Button>
      )}
      {/* "Cancelar" e não "Cancelar atendimento": ao lado de Liberar, dentro da linha
          daquele atendimento, o objeto já está dito e o rótulo longo era o que estourava
          a coluna Ações no celular. O diálogo continua escrevendo por extenso, que é
          onde a ambiguidade com o botão de desistir realmente existia. */}
      <Button variant="danger" disabled={atualizar.isPending} onClick={() => setConfirmando(true)}>
        Cancelar
      </Button>

      {/* Só o cancelamento confirma: liberar é reversível, cancelar mexe no saldo
          do pacote (invariante 4). */}
      <Confirmacao
        aberto={confirmando}
        titulo="Cancelar atendimento"
        mensagem="Cancelar este atendimento? O crédito volta ao pacote, se houver."
        rotuloConfirmar="Cancelar atendimento"
        enviando={atualizar.isPending}
        erro={atualizar.isError ? mensagemDeErro(atualizar.error) : undefined}
        aoConfirmar={() =>
          atualizar.mutate({ status: "Cancelado" }, { onSuccess: () => setConfirmando(false) })
        }
        aoCancelar={() => setConfirmando(false)}
      />
    </div>
  );
}
