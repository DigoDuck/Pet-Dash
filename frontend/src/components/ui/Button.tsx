import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerGhost";

const variants: Record<Variant, string> = {
  primary: "bg-marsala text-creme hover:bg-marsala-light",
  secondary: "border border-marsala text-marsala hover:bg-marsala/5",
  ghost: "text-escuro hover:bg-neutro-light/40",
  danger: "bg-erro text-creme hover:bg-erro/90",
  // Ação destrutiva repetida em cada linha de tabela. Sólido, o "Excluir" virava o
  // elemento mais alto da página, nove vezes. A confirmação continua `danger`: é lá que
  // o peso vermelho pertence.
  dangerGhost: "text-erro hover:bg-erro/10",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ouro disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-11 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
