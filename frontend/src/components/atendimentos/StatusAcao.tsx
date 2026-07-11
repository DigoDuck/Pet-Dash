import type { Atendimento } from "../../lib/types";
import { useAtualizarAtendimento } from "../../hooks/useAtendimentos";
import { Button } from "../ui/Button";

export function StatusAcao({ atendimento }: { atendimento: Atendimento }) {
  const atualizar = useAtualizarAtendimento(atendimento.id);

  function mudar(status: "Liberado" | "Cancelado") {
    if (status === "Cancelado" && !window.confirm("Cancelar este atendimento? O crédito volta ao pacote, se houver.")) {
      return;
    }
    atualizar.mutate({ status });
  }

  if (atendimento.status === "Cancelado") {
    return <span className="text-xs text-neutro">—</span>;
  }

  return (
    <div className="flex justify-end gap-2">
      {atendimento.status === "Pendente" && (
        <Button variant="secondary" disabled={atualizar.isPending} onClick={() => mudar("Liberado")}>
          Liberar
        </Button>
      )}
      <Button variant="danger" disabled={atualizar.isPending} onClick={() => mudar("Cancelado")}>
        Cancelar atendimento
      </Button>
    </div>
  );
}
