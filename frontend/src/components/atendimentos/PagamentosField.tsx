import { useFieldArray, type Control, type UseFormRegister, type UseFormWatch } from "react-hook-form";
import { formatarPreco } from "../../lib/formato";
import type { AtendimentoEntrada } from "../../lib/types";
import { Button } from "../ui/Button";

interface PagamentosFieldProps {
  control: Control<AtendimentoEntrada>;
  register: UseFormRegister<AtendimentoEntrada>;
  watch: UseFormWatch<AtendimentoEntrada>;
  /** Serviço + transporte no avulso; só o transporte no consumo de pacote. Quem
   *  calcula é o form, que é quem sabe se o pacote está sendo usado. */
  valorDevido: number;
}

const METODOS = ["Pix", "Cartao", "Dinheiro"] as const;

export function PagamentosField({ control, register, watch, valorDevido }: PagamentosFieldProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "pagamentos" });
  const pagamentos = watch("pagamentos") ?? [];

  const soma = pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
  const diferenca = Number((valorDevido - soma).toFixed(2));

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

      {/* O total a cobrar fica explícito: sem ele, a Patricia vê "Falta R$ 20,00"
          depois de lançar o valor do banho e não entende que o que falta é a corrida. */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutro">
          Total a cobrar: <span className="font-mono text-escuro">{formatarPreco(valorDevido)}</span>
        </span>
        {diferenca === 0 ? (
          <span className="text-sucesso">Soma confere</span>
        ) : diferenca > 0 ? (
          <span className="text-erro">Falta {formatarPreco(diferenca)}</span>
        ) : (
          <span className="text-erro">Sobra {formatarPreco(-diferenca)}</span>
        )}
      </div>
    </div>
  );
}
