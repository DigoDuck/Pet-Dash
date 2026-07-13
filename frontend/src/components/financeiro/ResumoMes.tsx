import { useDashboard } from "../../hooks/useDashboard";
import { formatarPreco } from "../../lib/formato";
import { KpiCard } from "../ui/KpiCard";

interface ResumoMesProps {
  inicio: string;
  fim: string;
}

/** Os dois totais do mês. Vêm agregados do backend (invariante 9), e não da soma
 *  das linhas da tabela: somar no cliente só acertaria enquanto tudo coubesse na
 *  primeira página, e passaria a mentir em silêncio depois. Por isso o filtro
 *  fixo/variável da tabela não mexe aqui — o card é sempre o mês inteiro. */
export function ResumoMes({ inicio, fim }: ResumoMesProps) {
  const { data, isPending, isError } = useDashboard(inicio, fim);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <KpiCard
        rotulo="Custos do mês"
        valor={data && formatarPreco(data.custos)}
        carregando={isPending}
        erro={isError}
      />
      <KpiCard
        rotulo="Retiradas do mês"
        valor={data && formatarPreco(data.retiradas)}
        carregando={isPending}
        erro={isError}
      />
    </div>
  );
}
