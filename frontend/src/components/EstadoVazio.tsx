import type { ReactNode } from "react";
import { Card } from "./ui/Card";

interface EstadoVazioProps {
  titulo: string;
  descricao: string;
  acao?: ReactNode;
}

export function EstadoVazio({ titulo, descricao, acao }: EstadoVazioProps) {
  return (
    <Card className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="text-lg font-medium text-escuro">{titulo}</p>
      <p className="text-sm text-neutro">{descricao}</p>
      {acao && <div className="mt-4">{acao}</div>}
    </Card>
  );
}
