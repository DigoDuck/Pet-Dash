import { useDashboard } from "../../hooks/useDashboard";
import { formatarPreco } from "../../lib/formato";
import { Card } from "../ui/Card";

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
      <Total rotulo="Custos do mês" valor={data?.custos} carregando={isPending} erro={isError} />
      <Total
        rotulo="Retiradas do mês"
        valor={data?.retiradas}
        carregando={isPending}
        erro={isError}
      />
    </div>
  );
}

interface TotalProps {
  rotulo: string;
  valor?: string;
  carregando: boolean;
  erro: boolean;
}

function Total({ rotulo, valor, carregando, erro }: TotalProps) {
  return (
    <Card>
      <p className="text-[10px] font-semibold tracking-[0.12em] text-neutro uppercase">{rotulo}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-escuro">
        {/* Um traço em vez de "R$ 0,00" quando a query falha: zero é um número, e
            um número errado numa tela de dinheiro é pior do que a ausência dele. */}
        {erro ? "—" : carregando || valor == null ? "..." : formatarPreco(valor)}
      </p>
    </Card>
  );
}
