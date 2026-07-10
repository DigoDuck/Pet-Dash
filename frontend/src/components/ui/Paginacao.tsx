import { TAMANHO_PAGINA } from "../../lib/types";
import { Button } from "./Button";

interface PaginacaoProps {
  pagina: number;
  /** Total de itens, vindo do `count` do DRF. */
  count: number;
  aoMudar: (pagina: number) => void;
  porPagina?: number;
}

export function Paginacao({ pagina, count, aoMudar, porPagina = TAMANHO_PAGINA }: PaginacaoProps) {
  const totalPaginas = Math.ceil(count / porPagina);
  if (totalPaginas <= 1) return null;

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-4 pt-4">
      <Button variant="ghost" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
        Anterior
      </Button>
      <span className="font-mono text-xs text-neutro">
        Página {pagina} de {totalPaginas}
      </span>
      <Button
        variant="ghost"
        disabled={pagina >= totalPaginas}
        onClick={() => aoMudar(pagina + 1)}
      >
        Próxima
      </Button>
    </nav>
  );
}
