import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { ServicoEntrada } from "../../lib/types";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Input } from "../ui/Input";

const PRECO = /^\d+(\.\d{1,2})?$/;

const schema = z
  .object({
    nome: z.string().min(1, "Informe o nome"),
    preco_padrao: z.string().regex(PRECO, "Preço inválido (ex.: 65.00)"),
    // Médio e grande são opcionais: a tabela da Patricia não tem preço de grande para
    // a maioria dos serviços. Vazio cai no preço do pequeno, e é melhor sugerir baixo
    // do que inventar um número.
    preco_m: z.string().regex(PRECO, "Preço inválido (ex.: 120.00)").or(z.literal("")),
    preco_g: z.string().regex(PRECO, "Preço inválido (ex.: 150.00)").or(z.literal("")),
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
      preco_m: inicial?.preco_m ?? "",
      preco_g: inicial?.preco_g ?? "",
      is_pacote: inicial?.is_pacote ?? false,
      creditos: inicial?.creditos != null ? String(inicial.creditos) : "4",
    },
  });

  const ehPacote = watch("is_pacote");

  function enviar(dados: FormData) {
    aoSalvar({
      nome: dados.nome,
      preco_padrao: dados.preco_padrao,
      // "" vira null: uma string vazia num DecimalField do DRF volta como 400.
      preco_m: dados.preco_m || null,
      preco_g: dados.preco_g || null,
      is_pacote: dados.is_pacote,
      creditos: dados.is_pacote ? Number(dados.creditos) : null,
    });
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4" noValidate>
      <Input label="Nome" error={formState.errors.nome?.message} {...register("nome")} />

      {/* Três preços porque a Patricia cobra por faixa de peso. Médio e grande em
          branco caem no preço do pequeno — a tabela dela não tem preço de grande para
          quase nada, e sugerir baixo é melhor do que inventar. */}
      <Input
        label="Preço · pequeno (até 10 kg)"
        inputMode="decimal"
        placeholder="65.00"
        error={formState.errors.preco_padrao?.message}
        {...register("preco_padrao")}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Preço · médio (10 a 15 kg)"
          inputMode="decimal"
          placeholder="Usa o do pequeno"
          error={formState.errors.preco_m?.message}
          {...register("preco_m")}
        />
        <Input
          label="Preço · grande (+15 kg)"
          inputMode="decimal"
          placeholder="Usa o do pequeno"
          error={formState.errors.preco_g?.message}
          {...register("preco_g")}
        />
      </div>
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
