import { formatarPreco } from "../../lib/formato";
import type { CategoriaCusto } from "../../lib/types";
import { Card } from "../ui/Card";

/** Marsala domina, ouro aparece pouco (proporção da marca). A cauda ("Outros") fica
 *  em neutro, para não competir com as categorias que a Patricia de fato nomeou. */
const CORES = ["bg-marsala", "bg-marsala-light", "bg-ouro", "bg-ouro-muted", "bg-neutro"];
const COR_OUTROS = "bg-neutro-light";

function cor(indice: number, categoria: string): string {
  return categoria === "Outros" ? COR_OUTROS : CORES[indice % CORES.length];
}

interface CustosPorCategoriaProps {
  categorias: CategoriaCusto[];
}

/** Para onde foi o dinheiro no mês. O backend já fundiu as variações de digitação
 *  ("Aluguel" / "aluguel") e cortou a cauda em "Outros" — aqui é só desenho. */
export function CustosPorCategoria({ categorias }: CustosPorCategoriaProps) {
  const total = categorias.reduce((soma, linha) => soma + Number(linha.valor), 0);

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-xl text-escuro">Despesas por categoria</h2>
        <span className="font-mono text-sm font-semibold text-escuro">
          {formatarPreco(total)}
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-6 text-sm text-neutro">Nenhum custo lançado neste mês.</p>
      ) : (
        <>
          <div className="mt-6 flex h-2.5 w-full overflow-hidden rounded-full bg-neutro-light/40">
            {categorias.map((linha, i) => (
              <div
                key={linha.categoria}
                className={cor(i, linha.categoria)}
                style={{ width: `${(Number(linha.valor) / total) * 100}%` }}
              />
            ))}
          </div>

          <ul className="mt-5 space-y-3">
            {categorias.map((linha, i) => (
              <li key={linha.categoria} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${cor(i, linha.categoria)}`} />
                  <span className="text-escuro">{linha.categoria}</span>
                </span>
                <span className="font-mono text-neutro">
                  {formatarPreco(linha.valor)}{" "}
                  <span className="text-xs">
                    ({Math.round((Number(linha.valor) / total) * 100)}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
