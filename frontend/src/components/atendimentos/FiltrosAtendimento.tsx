import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

interface FiltrosProps {
  data: string;
  status: string;
  aoMudarData: (v: string) => void;
  aoMudarStatus: (v: string) => void;
}

/** Dois `w-44` fixos somavam 368px e só cabiam raspando em 390px, estourando em 360.
 *  Com `flex-1` e piso de 160px eles dividem a linha no celular e quebram sozinhos na
 *  tela mais estreita, voltando à largura fixa a partir de `sm`. */
export function FiltrosAtendimento({ data, status, aoMudarData, aoMudarStatus }: FiltrosProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="min-w-40 flex-1 sm:w-44 sm:flex-none">
        <Input label="Data" type="date" value={data} onChange={(e) => aoMudarData(e.target.value)} />
      </div>
      <div className="min-w-40 flex-1 sm:w-44 sm:flex-none">
        <Select label="Status" value={status} onChange={(e) => aoMudarStatus(e.target.value)}>
          <option value="">Todos</option>
          <option value="Pendente">Pendente</option>
          <option value="Liberado">Liberado</option>
          <option value="Cancelado">Cancelado</option>
        </Select>
      </div>
    </div>
  );
}
