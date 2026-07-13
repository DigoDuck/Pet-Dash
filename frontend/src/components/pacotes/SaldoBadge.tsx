import { Badge } from "../ui/Badge";

interface SaldoBadgeProps {
  saldo: number;
  total: number;
}

/** Saldo zerado perde o destaque dourado: o pacote do mês acabou. */
export function SaldoBadge({ saldo, total }: SaldoBadgeProps) {
  return (
    <Badge variant={saldo === 0 ? "neutro" : "vip"}>
      {saldo}/{total} créditos
    </Badge>
  );
}
