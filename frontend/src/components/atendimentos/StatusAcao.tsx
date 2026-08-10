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
    <div className="flex justify-end gap-2">
      {atendimento.status === "Pendente" && (
        <Button
          variant="secondary"
          disabled={atualizar.isPending}
          onClick={() => atualizar.mutate({ status: "Liberado" })}
        >
          Liberar
        </Button>
      )}
      <Button variant="danger" disabled={atualizar.isPending} onClick={() => setConfirmando(true)}>
        Cancelar atendimento
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
