import { textoSaldo } from "../../lib/formato";

interface SaldoBadgeProps {
  saldo: number;
  total: number;
}

/** Um marcador por crédito: cheio = ainda disponível, vazio = usado. A frase ao lado
 *  diz o mesmo em palavras ("resta 1 de 4"), porque "1/4" deixava a dúvida entre usado
 *  e restante, e cor sozinha não carrega informação para quem não a distingue.
 *
 *  Acima de 8 créditos os marcadores viram ruído e só a frase fica. */
export function SaldoBadge({ saldo, total }: SaldoBadgeProps) {
  return (
    <span className="inline-flex items-center gap-2">
      {total <= 8 && (
        <span aria-hidden="true" className="flex gap-1">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${
                i < saldo ? "bg-ouro" : "border border-neutro/60 bg-transparent"
              }`}
            />
          ))}
        </span>
      )}
      <span className={`text-xs ${saldo > 0 ? "font-medium text-escuro-suave" : "text-neutro"}`}>
        {textoSaldo(saldo, total)}
      </span>
    </span>
  );
}
