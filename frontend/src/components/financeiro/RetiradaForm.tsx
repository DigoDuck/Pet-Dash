import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { hojeISO, inicioDaCompetencia, mesCorrente } from "../../lib/competencia";
import type { Retirada, RetiradaEntrada } from "../../lib/types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

const schema = z.object({
  descricao: z.string().min(1, "Informe a descrição"),
  valor: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (ex.: 500.00)")
    .refine((v) => Number(v) > 0, "O valor precisa ser maior que zero"),
  data: z.string().min(1, "Informe a data"),
  tipo: z.string(),
});

type FormData = z.infer<typeof schema>;

/** Hoje, se a página está no mês corrente; senão o dia 1 do mês que ela mostra.
 *  Sem isso, lançar uma retirada de um mês passado nasceria com a data de hoje —
 *  fora do intervalo que a própria lista filtra, e o registro sumiria da tela. */
function dataPadrao(mes: string): string {
  return mes === mesCorrente() ? hojeISO() : inicioDaCompetencia(mes);
}

interface RetiradaFormProps {
  inicial?: Retirada;
  /** Mês selecionado na página. */
  mesPadrao: string;
  aoSalvar: (dados: RetiradaEntrada) => void;
  enviando: boolean;
  erro?: string;
  aoCancelar: () => void;
}

export function RetiradaForm({
  inicial,
  mesPadrao,
  aoSalvar,
  enviando,
  erro,
  aoCancelar,
}: RetiradaFormProps) {
  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      descricao: inicial?.descricao ?? "",
      valor: inicial?.valor ?? "",
      data: inicial?.data ?? dataPadrao(mesPadrao),
      tipo: inicial?.tipo ?? "",
    },
  });

  // A arrow não é decorativa: o handleSubmit passa (dados, evento) ao callback, e
  // um `aoSalvar` que seja um mutate receberia o evento como options do mutation.
  return (
    <form
      onSubmit={handleSubmit((dados) => aoSalvar(dados))}
      className="flex flex-col gap-4"
      noValidate
    >
      {erro && (
        <p role="alert" className="rounded-lg bg-erro/10 px-3 py-2 text-sm text-erro">
          {erro}
        </p>
      )}

      <Input
        label="Descrição"
        placeholder="Pró-labore, retirada de lucro..."
        error={formState.errors.descricao?.message}
        {...register("descricao")}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Valor"
          inputMode="decimal"
          placeholder="500.00"
          error={formState.errors.valor?.message}
          {...register("valor")}
        />
        <Input
          label="Data"
          type="date"
          error={formState.errors.data?.message}
          {...register("data")}
        />
      </div>

      <Input
        label="Tipo"
        placeholder="Opcional: mensal, extra..."
        error={formState.errors.tipo?.message}
        {...register("tipo")}
      />

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
