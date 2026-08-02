import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { somarMeses } from "../../lib/competencia";
import { Button } from "./Button";
import { Input } from "./Input";

const MES_COMPLETO = /^\d{4}-\d{2}$/;

interface SeletorMesProps {
  valor: string;
  aoMudar: (mes: string) => void;
  label?: string;
}

/** Seletor de competência. Nunca entrega um mês incompleto a quem o consome.
 *
 *  Duas armadilhas moram aqui:
 *
 *  1. O campo pode ficar vazio ou pela metade, e o valor incompleto quebra as duas
 *     pontas: `ultimoDiaDoMes("")` vira Invalid Date e o toISOString() estoura
 *     RangeError durante o render (tela branca), enquanto `inicioDaCompetencia("")`
 *     vira "-01" — string truthy que segue para a query e volta 400 do DRF. Daí o
 *     guard do MES_COMPLETO na subida.
 *
 *  2. O Firefox não implementa `<input type="month">`: cai para campo de texto, sem
 *     picker. Com o input controlado direto por `valor`, o guard rejeitava CADA tecla
 *     ("2", "20", "202"...) e o React reescrevia o mês antigo — o campo ficava
 *     literalmente travado no mês corrente. Por isso o texto digitado vive em estado
 *     local: ele acompanha a digitação e só o mês completo sobe. No blur o campo
 *     volta ao último mês válido, que é o mesmo motivo do item 1: não existe estado
 *     "vazio" que faça sentido para um filtro de mês.
 *
 *  As setas são o que torna a troca de mês possível sem picker — no Firefox, sem
 *  elas, a alternativa é digitar "2026-07" na mão. */
export function SeletorMes({ valor, aoMudar, label = "Mês" }: SeletorMesProps) {
  const [texto, setTexto] = useState(valor);

  // O pai também muda o mês (setas, reset de tela); sem isto o campo mostraria o
  // texto velho.
  useEffect(() => setTexto(valor), [valor]);

  return (
    <div className="flex items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        className="px-2"
        aria-label="Mês anterior"
        onClick={() => aoMudar(somarMeses(valor, -1))}
      >
        <ChevronLeft size={18} aria-hidden />
      </Button>
      <Input
        label={label}
        type="month"
        placeholder="AAAA-MM"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          if (MES_COMPLETO.test(e.target.value)) aoMudar(e.target.value);
        }}
        onBlur={() => setTexto(valor)}
      />
      <Button
        type="button"
        variant="ghost"
        className="px-2"
        aria-label="Próximo mês"
        onClick={() => aoMudar(somarMeses(valor, 1))}
      >
        <ChevronRight size={18} aria-hidden />
      </Button>
    </div>
  );
}
