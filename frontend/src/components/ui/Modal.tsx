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
          className="fixed top-1/2 left-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-neutro-light/60 bg-creme p-6 shadow-lg"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="font-display text-xl text-escuro">{titulo}</Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded-lg p-1 text-neutro transition-colors hover:bg-neutro-light/40 hover:text-escuro"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
