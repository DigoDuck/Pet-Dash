import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

interface FiltrosProps {
  data: string;
  status: string;
  aoMudarData: (v: string) => void;
  aoMudarStatus: (v: string) => void;
}

export function FiltrosAtendimento({ data, status, aoMudarData, aoMudarStatus }: FiltrosProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="w-44">
        <Input label="Data" type="date" value={data} onChange={(e) => aoMudarData(e.target.value)} />
      </div>
      <div className="w-44">
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
