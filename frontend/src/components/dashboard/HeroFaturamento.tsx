import { CalendarPlus, ReceiptText, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

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
 *  O brilho é um radial no próprio fundo, e não uma div desfocada por cima: blur
 *  decorativo é peso de render sem informação. */
export function HeroFaturamento({
  faturamento,
  lucro,
  margem,
  mes,
  carregando,
  erro,
}: HeroFaturamentoProps) {
  return (
    <section
      className="relative h-full overflow-hidden rounded-xl bg-marsala p-6 text-creme shadow-sm"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 60% at 100% 0%, var(--color-marsala-light), transparent 70%)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-ouro-light uppercase">
            Faturamento
          </p>
          <p className="mt-0.5 text-sm text-creme/70">{mes}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-marsala-dark/60 text-ouro">
          <Wallet className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>

      {/* Erro mostra "—", nunca "R$ 0,00": zero é um número, e um número errado numa
          tela de dinheiro é pior do que a ausência dele. */}
      <p className="mt-6 font-mono text-4xl font-semibold tracking-tight sm:text-5xl">
        {erro ? "—" : carregando || faturamento == null ? "···" : faturamento}
      </p>

      <p className="mt-3 min-h-5 text-sm text-creme/80">
        {!erro && !carregando && lucro && margem && (
          <>
            Lucro de <span className="font-mono font-semibold text-creme">{lucro}</span> · margem
            de <span className="font-mono font-semibold text-creme">{margem}</span>
          </>
        )}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          to="/atendimentos/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-ouro px-3.5 py-2 text-sm font-semibold text-escuro transition-colors hover:bg-ouro-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-creme"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          Novo atendimento
        </Link>
        <Link
          to="/financeiro"
          className="inline-flex items-center gap-2 rounded-lg border border-creme/30 px-3.5 py-2 text-sm font-semibold text-creme transition-colors hover:bg-creme/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-creme"
        >
          <ReceiptText className="h-4 w-4" aria-hidden="true" />
          Lançar custo
        </Link>
      </div>
    </section>
  );
}
