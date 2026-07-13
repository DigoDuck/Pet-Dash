import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { inicioDaCompetencia, mesDaCompetencia } from "../../lib/competencia";
import type { Custo, CustoEntrada } from "../../lib/types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const schema = z.object({
  descricao: z.string().min(1, "Informe a descrição"),
  tipo: z.enum(["fixo", "variavel"]),
  // O valor viaja como string do form ao DRF (DecimalField). Number() só aqui,
  // para checar o sinal: um custo de R$ 0 é sempre erro de digitação.
  valor: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (ex.: 1200.00)")
    .refine((v) => Number(v) > 0, "O valor precisa ser maior que zero"),
  categoria: z.string(),
  mes: z.string().min(1, "Informe a competência"),
});

type FormData = z.infer<typeof schema>;

interface CustoFormProps {
  inicial?: Custo;
  /** Mês selecionado na página; vira o default da competência num custo novo. */
  mesPadrao: string;
  aoSalvar: (dados: CustoEntrada) => void;
  enviando: boolean;
  erro?: string;
  aoCancelar: () => void;
}

export function CustoForm({
  inicial,
  mesPadrao,
  aoSalvar,
  enviando,
  erro,
  aoCancelar,
}: CustoFormProps) {
  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      descricao: inicial?.descricao ?? "",
      tipo: inicial?.tipo ?? "fixo",
      valor: inicial?.valor ?? "",
      categoria: inicial?.categoria ?? "",
      mes: inicial ? mesDaCompetencia(inicial.competencia) : mesPadrao,
    },
  });

  function enviar(dados: FormData) {
    aoSalvar({
      descricao: dados.descricao,
      tipo: dados.tipo,
      valor: dados.valor,
      categoria: dados.categoria,
      // A competência é sempre o dia 1 do mês (invariante 10): é o que faz
      // editar o aluguel de junho não reescrever o de maio.
      competencia: inicioDaCompetencia(dados.mes),
    });
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4" noValidate>
      {erro && (
        <p role="alert" className="rounded-lg bg-erro/10 px-3 py-2 text-sm text-erro">
          {erro}
        </p>
      )}

      <Input
        label="Descrição"
        placeholder="Aluguel, shampoo, energia..."
        error={formState.errors.descricao?.message}
        {...register("descricao")}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select label="Tipo" error={formState.errors.tipo?.message} {...register("tipo")}>
          <option value="fixo">Fixo</option>
          <option value="variavel">Variável</option>
        </Select>
        <Input
          label="Valor"
          inputMode="decimal"
          placeholder="1200.00"
          error={formState.errors.valor?.message}
          {...register("valor")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Categoria"
          placeholder="Opcional: Estrutura, Insumos..."
          error={formState.errors.categoria?.message}
          {...register("categoria")}
        />
        <Input
          label="Competência"
          type="month"
          error={formState.errors.mes?.message}
          {...register("mes")}
        />
      </div>

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
