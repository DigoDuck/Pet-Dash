import type { Pet } from "../../lib/types";
import { Badge } from "../ui/Badge";

/** Badges de estado e condição do pet. Três call sites (card do tutor, ficha do pet,
 *  tabela da aba Pets); repetir a lista nos três é onde a quarta condição seria
 *  esquecida em dois deles. */
export function BadgesPet({ pet }: { pet: Pet }) {
  return (
    <>
      {pet.vip && <Badge variant="vip">VIP</Badge>}
      {pet.agressivo && <Badge variant="erro">Agressivo</Badge>}
      {pet.otite && <Badge variant="pendente">Otite</Badge>}
      {pet.problema_pele && <Badge variant="pendente">Pele</Badge>}
    </>
  );
}
