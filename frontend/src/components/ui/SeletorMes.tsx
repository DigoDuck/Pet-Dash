import { Input } from "./Input";

const MES_COMPLETO = /^\d{4}-\d{2}$/;

interface SeletorMesProps {
  valor: string;
  aoMudar: (mes: string) => void;
  label?: string;
}

/** `<input type="month">` que nunca entrega um mês incompleto a quem o consome.
 *
 *  O campo pode ser esvaziado (o navegador oferece um botão de limpar), e o "" que
 *  ele emite quebra as duas pontas: `ultimoDiaDoMes("")` vira Invalid Date e o
 *  toISOString() estoura RangeError durante o render (tela branca), enquanto
 *  `inicioDaCompetencia("")` vira "-01" — string truthy que segue para a query e
 *  volta como 400 do DRF, derrubando a lista com um "erro ao carregar" sem causa
 *  aparente.
 *
 *  Como o input é controlado, ignorar o valor incompleto faz ele voltar sozinho ao
 *  último mês válido: o filtro de mês não tem estado "vazio" que faça sentido. */
export function SeletorMes({ valor, aoMudar, label = "Mês" }: SeletorMesProps) {
  return (
    <Input
      label={label}
      type="month"
      value={valor}
      onChange={(e) => {
        if (MES_COMPLETO.test(e.target.value)) aoMudar(e.target.value);
      }}
    />
  );
}
