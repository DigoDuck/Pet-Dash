import type { HTMLAttributes } from "react";

type Variant = "vip" | "sucesso" | "erro" | "pendente" | "neutro";

// Contraste medido sobre o creme, em texto de 12px (mínimo AA 4.5:1). O dourado nunca é
// cor de texto aqui: `text-ouro-muted` dava 2,8:1. O marsala profundo existe para isso.
// `pendente` é exclusivo do status Pendente; tipo e origem (Avulso, Fixo) usam `neutro`,
// senão a mesma cor diz duas coisas na mesma linha.
const variants: Record<Variant, string> = {
  vip: "border border-ouro/60 bg-ouro/15 text-marsala-dark",
  sucesso: "border border-sucesso/30 bg-sucesso/5 text-sucesso",
  erro: "bg-erro/10 text-erro",
  pendente: "bg-ouro-light/40 text-escuro-suave",
  neutro: "bg-neutro-light/40 text-escuro-suave",
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
