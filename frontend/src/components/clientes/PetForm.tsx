import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { PetEntrada } from "../../hooks/usePets";
import { PORTES } from "../../lib/types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const schema = z.object({
  nome: z.string().min(1, "Informe o nome"),
  raca: z.string(),
  porte: z.enum(["", "P", "M", "G"]),
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
    defaultValues: inicial ?? { nome: "", raca: "", porte: "" },
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
