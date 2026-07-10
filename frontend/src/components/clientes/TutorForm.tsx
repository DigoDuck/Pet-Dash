import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { TutorEntrada } from "../../hooks/useTutores";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

const schema = z.object({
  nome: z.string().min(1, "Informe o nome"),
  telefone: z.string().min(1, "Informe o telefone"),
  email: z.union([z.literal(""), z.email("E-mail inválido")]),
});

type FormData = z.infer<typeof schema>;

interface TutorFormProps {
  inicial?: TutorEntrada;
  aoSalvar: (dados: TutorEntrada) => void;
  enviando: boolean;
  aoCancelar: () => void;
}

export function TutorForm({ inicial, aoSalvar, enviando, aoCancelar }: TutorFormProps) {
  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: inicial ?? { nome: "", telefone: "", email: "" },
  });

  return (
    <form
      onSubmit={handleSubmit((dados) => aoSalvar(dados))}
      className="flex flex-col gap-4"
      noValidate
    >
      <Input label="Nome" error={formState.errors.nome?.message} {...register("nome")} />
      <Input
        label="Telefone"
        inputMode="tel"
        error={formState.errors.telefone?.message}
        {...register("telefone")}
      />
      <Input
        label="E-mail"
        type="email"
        error={formState.errors.email?.message}
        {...register("email")}
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
