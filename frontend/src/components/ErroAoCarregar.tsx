import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

interface ErroAoCarregarProps {
  mensagem?: string;
  aoTentarDeNovo: () => void;
}

export function ErroAoCarregar({
  mensagem = "Não foi possível carregar os dados.",
  aoTentarDeNovo,
}: ErroAoCarregarProps) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <p role="alert" className="text-sm text-erro">
        {mensagem}
      </p>
      <Button variant="secondary" onClick={aoTentarDeNovo}>
        Tentar de novo
      </Button>
    </Card>
  );
}
