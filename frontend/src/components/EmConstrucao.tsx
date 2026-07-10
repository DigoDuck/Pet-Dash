import { Card } from "./ui/Card";

export function EmConstrucao({ titulo }: { titulo: string }) {
  return (
    <div>
      <h1 className="font-display text-3xl text-escuro">{titulo}</h1>
      <Card className="mt-6 flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-lg font-medium text-escuro">Em construção</p>
        <p className="text-sm text-neutro">Esta página chega num próximo PR.</p>
      </Card>
    </div>
  );
}
