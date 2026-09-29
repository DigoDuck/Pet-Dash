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
    return (
      <>
        <span aria-hidden="true" className="text-xs text-neutro">
          —
        </span>
        <span className="sr-only">Sem ações</span>
      </>
    );
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
      {/* Discreto na linha; o peso vermelho fica na confirmação. Sólido, era o elemento
          mais forte da tela mais usada, ao lado do Liberar, que é a ação frequente. */}
      <Button
        variant="dangerGhost"
        disabled={atualizar.isPending}
        onClick={() => {
          // Sem o reset, o erro de um Liberar que falhou aparecia dentro deste diálogo,
          // como se fosse do cancelamento.
          atualizar.reset();
          setConfirmando(true);
        }}
      >
        Cancelar
      </Button>

      {/* O Liberar não tem diálogo, então o erro dele fica na própria linha. Antes ele
          falhava calado: com o 4G do balcão caindo, o botão voltava e ela achava que
          tinha liberado. */}
      {atualizar.isError && !confirmando && (
        <p role="alert" className="text-xs text-erro">
          Não liberou. Confira a internet e tente de novo.
        </p>
      )}

      {/* Só o cancelamento confirma: liberar é reversível, cancelar mexe no saldo
          do pacote (invariante 4). */}
      <Confirmacao
        aberto={confirmando}
        titulo="Cancelar atendimento"
        // O componente sabe se há pacote; "se houver" jogava a dúvida para ela.
        mensagem={
          atendimento.pacote !== null
            ? "Cancelar este atendimento? O crédito volta para o pacote."
            : "Cancelar este atendimento? Ele continua no histórico, marcado como cancelado."
        }
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
