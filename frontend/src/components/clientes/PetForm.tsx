import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { PetEntrada } from "../../hooks/usePets";
import { PORTES } from "../../lib/types";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const schema = z.object({
  nome: z.string().min(1, "Informe o nome"),
  raca: z.string(),
  porte: z.enum(["", "P", "M", "G"]),
  agressivo: z.boolean(),
  otite: z.boolean(),
  problema_pele: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface PetFormProps {
  tutorId: number;
  inicial?: Omit<PetEntrada, "tutor">;
  aoSalvar: (dados: PetEntrada) => void;
  enviando: boolean;
  aoCancelar: () => void;
}

export function PetForm({ tutorId, inicial, aoSalvar, enviando, aoCancelar }: PetFormProps) {
  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    // Os três booleans precisam estar aqui: sem valor inicial o input nasce
    // não-controlado e o payload sai com `undefined` no lugar de `false`.
    defaultValues: inicial ?? {
      nome: "", raca: "", porte: "",
      agressivo: false, otite: false, problema_pele: false,
    },
  });

  return (
    <form
      onSubmit={handleSubmit((dados) => aoSalvar({ ...dados, tutor: tutorId }))}
      className="flex flex-col gap-4"
      noValidate
    >
      <Input label="Nome" error={formState.errors.nome?.message} {...register("nome")} />
      <Input label="Raça" error={formState.errors.raca?.message} {...register("raca")} />
      <Select label="Porte" error={formState.errors.porte?.message} {...register("porte")}>
        {PORTES.map((p) => (
          <option key={p.valor} value={p.valor}>
            {p.rotulo}
          </option>
        ))}
      </Select>

      {/* Só o `agressivo` chega a mexer em dinheiro: ele pré-marca o manejo especial na
          criação do atendimento (+40% na sugestão). Otite e pele são aviso puro. */}
      <Checkbox label="Pet agressivo / precisa de contenção" {...register("agressivo")} />
      <Checkbox label="Tem otite" {...register("otite")} />
      <Checkbox label="Tem problema de pele" {...register("problema_pele")} />

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
