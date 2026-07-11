import { useFieldArray, type Control, type UseFormRegister, type UseFormWatch } from "react-hook-form";
import type { AtendimentoEntrada } from "../../lib/types";
import { Button } from "../ui/Button";

interface PagamentosFieldProps {
  control: Control<AtendimentoEntrada>;
  register: UseFormRegister<AtendimentoEntrada>;
  watch: UseFormWatch<AtendimentoEntrada>;
  valorAtendimento: string;
}

const METODOS = ["Pix", "Cartao", "Dinheiro"] as const;

function formatarReais(n: number): string {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

export function PagamentosField({ control, register, watch, valorAtendimento }: PagamentosFieldProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "pagamentos" });
  const pagamentos = watch("pagamentos") ?? [];

  const soma = pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
  const alvo = Number(valorAtendimento || 0);
  const diferenca = Number((alvo - soma).toFixed(2));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-escuro">Pagamentos</span>
        <Button
          type="button"
          variant="ghost"
          onClick={() => append({ metodo: "Pix", valor: "" })}
        >
          Adicionar pagamento
        </Button>
      </div>

      {fields.map((field, i) => (
        <div key={field.id} className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`pag-metodo-${i}`} className="text-xs font-medium text-neutro">
              Método
            </label>
            <select
              id={`pag-metodo-${i}`}
              className="rounded-lg border border-neutro-light bg-white px-3 py-2 text-sm text-escuro"
              {...register(`pagamentos.${i}.metodo`)}
            >
              {METODOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor={`pag-valor-${i}`} className="text-xs font-medium text-neutro">
              Valor
            </label>
            <input
              id={`pag-valor-${i}`}
              inputMode="decimal"
              placeholder="0.00"
              className="rounded-lg border border-neutro-light bg-white px-3 py-2 text-sm text-escuro"
              {...register(`pagamentos.${i}.valor`)}
            />
          </div>
          <Button type="button" variant="ghost" onClick={() => remove(i)}>
            Remover
          </Button>
        </div>
      ))}

      <div className="text-sm">
        {diferenca === 0 ? (
          <span className="text-sucesso">Soma confere</span>
        ) : diferenca > 0 ? (
          <span className="text-erro">Falta {formatarReais(diferenca)}</span>
        ) : (
          <span className="text-erro">Sobra {formatarReais(-diferenca)}</span>
        )}
      </div>
    </div>
  );
}
