import type { Pacote } from "../../lib/types";

interface PacoteAtivoBannerProps {
  pacote: Pacote;
  aoCobrarAvulso: () => void;
}

export function PacoteAtivoBanner({ pacote, aoCobrarAvulso }: PacoteAtivoBannerProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-ouro/40 bg-ouro/10 p-4">
      <div className="text-sm">
        <p className="font-medium text-escuro">Pacote Fidelidade vinculado</p>
        <p className="text-neutro">
          Saldo {pacote.saldo}/{pacote.qtd_total} · este atendimento consome 1 crédito
        </p>
      </div>
      <button
        type="button"
        onClick={aoCobrarAvulso}
        className="shrink-0 text-sm font-medium text-marsala hover:underline"
      >
        Cobrar como avulso
      </button>
    </div>
  );
}
