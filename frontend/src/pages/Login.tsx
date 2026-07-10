import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { ApiError, login } from "../lib/api";

const schema = z.object({
  username: z.string().min(1, "Informe o usuário"),
  password: z.string().min(1, "Informe a senha"),
});

type FormData = z.infer<typeof schema>;

export function Login() {
  const navigate = useNavigate();
  const [erroApi, setErroApi] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setErroApi(null);
    try {
      await login(data.username, data.password);
      navigate("/");
    } catch (e) {
      setErroApi(
        e instanceof ApiError && e.status === 401
          ? "Usuário ou senha inválidos"
          : "Erro ao conectar. Tente novamente.",
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-fundo p-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex justify-center rounded-lg bg-marsala p-4">
          <img src="/logo.png" alt="Ângelo Spa Animal" className="h-16" />
        </div>
        <h1 className="font-display text-2xl text-escuro">PetDash</h1>
        <p className="mb-6 text-sm text-neutro">Gestão do Ângelo Spa Animal</p>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Input
            label="Usuário"
            autoComplete="username"
            error={formState.errors.username?.message}
            {...register("username")}
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            error={formState.errors.password?.message}
            {...register("password")}
          />
          {erroApi && (
            <p role="alert" className="text-sm text-erro">
              {erroApi}
            </p>
          )}
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
