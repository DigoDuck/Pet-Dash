import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  aberto: boolean;
  titulo: string;
  /** Chamado no Esc, no clique no backdrop e no botão de fechar. */
  aoFechar: () => void;
  children: ReactNode;
}

export function Modal({ aberto, titulo, aoFechar, children }: ModalProps) {
  return (
    <Dialog.Root open={aberto} onOpenChange={(estaAberto) => !estaAberto && aoFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-escuro/50" />
        {/* aria-describedby={undefined}: o título já descreve o diálogo. É o
            idiom do Radix para dispensar o Description sem o aviso de console. */}
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 flex max-h-[85dvh] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-neutro-light/60 bg-creme p-4 shadow-lg sm:p-6"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="font-display text-xl text-escuro">{titulo}</Dialog.Title>
            {/* `p-1` num ícone de 16px dava um alvo de ~24px, o menor da interface — e
                é como se fecha todo modal no celular. O `-m-1` devolve o espaço extra
                para fora, então o botão cresce sem empurrar o título. */}
            <Dialog.Close
              aria-label="Fechar"
              className="flex items-center justify-center rounded-lg p-1 text-neutro transition-colors hover:bg-neutro-light/40 hover:text-escuro pointer-coarse:-m-1 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
