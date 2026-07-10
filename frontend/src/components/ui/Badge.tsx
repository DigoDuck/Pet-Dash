import type { HTMLAttributes } from "react";

type Variant = "vip" | "sucesso" | "erro" | "pendente" | "neutro";

const variants: Record<Variant, string> = {
  vip: "border border-ouro/40 bg-ouro/15 text-ouro-muted",
  sucesso: "bg-sucesso/10 text-sucesso",
  erro: "bg-erro/10 text-erro",
  pendente: "bg-ouro-light/40 text-escuro-suave",
  neutro: "bg-neutro-light/40 text-neutro",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ variant = "neutro", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
