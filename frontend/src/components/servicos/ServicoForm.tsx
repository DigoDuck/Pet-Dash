import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { ServicoEntrada } from "../../lib/types";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Input } from "../ui/Input";

const schema = z
  .object({
    nome: z.string().min(1, "Informe o nome"),
    preco_padrao: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Preço inválido (ex.: 60.00)"),
    is_pacote: z.boolean(),
    // String no form; convertida/validada no superRefine.
    creditos: z.string(),
  })
  .superRefine((dados, ctx) => {
    if (dados.is_pacote) {
      const n = Number(dados.creditos);
      if (!Number.isInteger(n) || n < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["creditos"],
          message: "Pacote precisa de ao menos 1 crédito",
        });
      }
    }
  });

type FormData = z.infer<typeof schema>;

interface ServicoFormProps {
  inicial?: ServicoEntrada;
  aoSalvar: (dados: ServicoEntrada) => void;
  enviando: boolean;
  aoCancelar: () => void;
}

export function ServicoForm({ inicial, aoSalvar, enviando, aoCancelar }: ServicoFormProps) {
  const { register, handleSubmit, watch, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: inicial?.nome ?? "",
      preco_padrao: inicial?.preco_padrao ?? "",
      is_pacote: inicial?.is_pacote ?? false,
      creditos: inicial?.creditos != null ? String(inicial.creditos) : "4",
    },
  });

  const ehPacote = watch("is_pacote");

  function enviar(dados: FormData) {
    aoSalvar({
      nome: dados.nome,
      preco_padrao: dados.preco_padrao,
      is_pacote: dados.is_pacote,
      creditos: dados.is_pacote ? Number(dados.creditos) : null,
    });
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4" noValidate>
      <Input label="Nome" error={formState.errors.nome?.message} {...register("nome")} />
      <Input
        label="Preço"
        inputMode="decimal"
        placeholder="60.00"
        error={formState.errors.preco_padrao?.message}
        {...register("preco_padrao")}
      />
      <Checkbox label="É pacote?" {...register("is_pacote")} />
      {ehPacote && (
        <Input
          label="Créditos"
          type="number"
          min={1}
          error={formState.errors.creditos?.message}
          {...register("creditos")}
        />
      )}
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
