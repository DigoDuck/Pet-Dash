import { CalendarPlus, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";

/** "2026-07" -> "julho de 2026". */
function nomeDoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, m - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface HeroFaturamentoProps {
  /** Já formatados pelo chamador, como no KpiCard. */
  faturamento?: string;
  lucro?: string;
  margem?: string;
  mes: string;
  carregando: boolean;
  erro: boolean;
}

/** O número-manchete do mês, na cor da marca.
 *
 *  Não reusa o `Card`: ele fixa `bg-creme`, e empilhar `bg-marsala` por cima seria um
 *  conflito de classe resolvido pela ordem do CSS gerado, não pela ordem no atributo —
 *  consertar isso pediria `tailwind-merge`, uma dependência inteira por um componente
 *  usado uma vez.
 *
 *  Sem gradiente, sem ícone em caixa, sem número gigante: os três juntos eram o cartão
 *  de template que o DESIGN.md recusa. O marsala fica; o enfeite sai. */
export function HeroFaturamento({
  faturamento,
  lucro,
  margem,
  mes,
  carregando,
  erro,
}: HeroFaturamentoProps) {
  return (
    <section className="h-full rounded-xl bg-marsala p-6 text-creme shadow-sm">
      <p className="text-xs font-semibold tracking-[0.12em] text-ouro-light uppercase">
        Faturamento
      </p>
      {/* "julho de 2026", não "2026-07": o formato do input vazava para a manchete. */}
      <p className="mt-0.5 text-sm text-creme/80">{nomeDoMes(mes)}</p>

      {/* Erro mostra "—", nunca "R$ 0,00": zero é um número, e um número errado numa
          tela de dinheiro é pior do que a ausência dele.

          Para em `sm:text-4xl`: "R$ 123.456,78" em mono maior que isso passa da largura
          que sobra num telefone de 390px. */}
      <p className="mt-6 font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
        {erro ? "—" : carregando || faturamento == null ? "···" : faturamento}
      </p>

      <p className="mt-3 min-h-5 text-sm text-creme/80">
        {/* Nove traços sem frase pareciam um mês zerado, que é justamente o medo dela. */}
        {erro && "Não foi possível carregar os números do mês. Recarregue a página."}
        {!erro && !carregando && lucro && margem && (
          <>
            Lucro de <span className="font-mono font-semibold text-creme">{lucro}</span> · margem
            de <span className="font-mono font-semibold text-creme">{margem}</span>
          </>
        )}
      </p>

      {/* São links, não o `Button`, então não herdam o alvo de toque de 44px que ele
          aplica em ponteiro grosso. Sem isto ficam em ~36px, e são as duas ações
          principais da tela inicial no celular. */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          to="/atendimentos/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-ouro px-3.5 py-2 text-sm font-semibold text-escuro transition-colors hover:bg-ouro-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-creme pointer-coarse:min-h-11"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          Novo atendimento
        </Link>
        <Link
          to="/financeiro"
          className="inline-flex items-center gap-2 rounded-lg border border-creme/30 px-3.5 py-2 text-sm font-semibold text-creme transition-colors hover:bg-creme/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-creme pointer-coarse:min-h-11"
        >
          <ReceiptText className="h-4 w-4" aria-hidden="true" />
          {/* O link só leva à página; "Lançar custo" prometia abrir o formulário. */}
          Ver custos
        </Link>
      </div>
    </section>
  );
}
