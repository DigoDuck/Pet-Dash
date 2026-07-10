import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="font-display text-3xl text-escuro">Página não encontrada</h1>
      <Link to="/" className="text-sm text-marsala underline">
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
