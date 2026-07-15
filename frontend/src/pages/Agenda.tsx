import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AtendimentoTabela } from "../components/atendimentos/AtendimentoTabela";
import { ErroAoCarregar } from "../components/ErroAoCarregar";
import { Button } from "../components/ui/Button";
import { useAgenda } from "../hooks/useAtendimentos";
import {
  diaCurto,
  diasDaSemana,
  formatarData,
  hojeISO,
  inicioDaSemana,
  somarDias,
} from "../lib/competencia";
import type { Atendimento } from "../lib/types";

const ALTURA_HORA = 64;
const DIAS = 6; // segunda a sábado; o spa não abre domingo

/** A faixa de horas da grade, derivada dos dados — nunca fixa.
 *
 *  Uma grade fixa 8h–18h faria um atendimento das 19h **sumir da tela sem erro nenhum**.
 *  Começa no padrão do spa e só expande se houver algo fora dele. */
function faixaDeHoras(atendimentos: Atendimento[]): number[] {
  const horas = atendimentos.map((a) => Number(a.horario.slice(0, 2)));
  const primeira = Math.min(8, ...horas);
  const ultima = Math.max(18, ...horas);
  return Array.from({ length: ultima - primeira + 1 }, (_, i) => primeira + i);
}

const CORES: Record<Atendimento["status"], string> = {
  Liberado: "bg-marsala text-creme",
  Pendente: "bg-creme text-escuro border border-neutro-light",
  Cancelado: "bg-neutro-light/40 text-neutro line-through",
};

export function Agenda() {
  const navigate = useNavigate();
  const [segunda, setSegunda] = useState(() => inicioDaSemana(hojeISO()));

  const dias = diasDaSemana(segunda, DIAS);
  const fim = dias[dias.length - 1];
  const { data, isPending, isError, refetch } = useAgenda(segunda, fim);

  const atendimentos = data?.results ?? [];
  const horas = faixaDeHoras(atendimentos);
  const hoje = hojeISO();

  // A tabela é a mesma dos Atendimentos, filtrada para o que ainda vai acontecer.
  // Cancelado fica de fora: não é um próximo atendimento, é um que não vai existir.
  const proximos = atendimentos
    .filter((a) => a.data >= hoje && a.status !== "Cancelado")
    .sort((a, b) => `${a.data}${a.horario}`.localeCompare(`${b.data}${b.horario}`));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-escuro">Agenda</h1>
        <Button onClick={() => navigate("/atendimentos/novo")}>
          <Plus className="h-4 w-4" /> Novo atendimento
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label="Semana anterior"
          onClick={() => setSegunda(somarDias(segunda, -7))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutro-light bg-creme text-neutro hover:text-escuro"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="rounded-lg border border-neutro-light bg-creme px-4 py-2 text-sm font-semibold text-escuro">
          {formatarData(segunda)} – {formatarData(fim)}
        </span>
        <button
          type="button"
          aria-label="Próxima semana"
          onClick={() => setSegunda(somarDias(segunda, 7))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutro-light bg-creme text-neutro hover:text-escuro"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <Button variant="secondary" onClick={() => setSegunda(inicioDaSemana(hoje))}>
          Hoje
        </Button>
      </div>

      {isError ? (
        <div className="mt-6">
          <ErroAoCarregar aoTentarDeNovo={() => refetch()} />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-neutro-light/60 bg-creme">
          <div
            className="grid min-w-180"
            style={{ gridTemplateColumns: `56px repeat(${DIAS}, minmax(0, 1fr))` }}
          >
            <div className="border-r border-b border-neutro-light/60" />
            {dias.map((dia) => (
              <div
                key={dia}
                className={`border-r border-b border-neutro-light/60 px-2 py-3 text-center last:border-r-0 ${
                  dia === hoje ? "bg-marsala/5" : ""
                }`}
              >
                <div
                  className={`text-[10px] font-semibold tracking-[0.12em] uppercase ${
                    dia === hoje ? "text-marsala" : "text-neutro"
                  }`}
                >
                  {diaCurto(dia)}
                  {dia === hoje && " · hoje"}
                </div>
                <div
                  className={`mt-1 font-display text-xl ${
                    dia === hoje ? "text-marsala" : "text-escuro"
                  }`}
                >
                  {dia.slice(8)}
                </div>
              </div>
            ))}

            <div className="border-r border-neutro-light/60">
              {horas.map((h) => (
                <div
                  key={h}
                  style={{ height: ALTURA_HORA }}
                  className="border-b border-neutro-light/40 pt-1 pr-2 text-right font-mono text-[11px] text-neutro last:border-b-0"
                >
                  {String(h).padStart(2, "0")}h
                </div>
              ))}
            </div>

            {dias.map((dia) => (
              <div
                key={dia}
                className={`relative border-r border-neutro-light/60 last:border-r-0 ${
                  dia === hoje ? "bg-marsala/3" : ""
                }`}
              >
                {horas.map((h) => (
                  <div
                    key={h}
                    style={{ height: ALTURA_HORA }}
                    className="border-b border-neutro-light/40 last:border-b-0"
                  />
                ))}

                {isPending && <p className="p-2 text-xs text-neutro">...</p>}

                {atendimentos
                  .filter((a) => a.data === dia)
                  .map((a) => (
                    <Link
                      key={a.id}
                      to={`/atendimentos/${a.id}/editar`}
                      // Bloco de 1h fixo: o model não tem duração, e inventar uma seria
                      // desenhar na tela um dado que não existe.
                      style={{
                        top: (Number(a.horario.slice(0, 2)) - horas[0]) * ALTURA_HORA + 4,
                        height: ALTURA_HORA - 8,
                      }}
                      className={`absolute right-1 left-1 overflow-hidden rounded-lg px-2 py-1.5 text-[11px] leading-tight shadow-sm ${CORES[a.status]}`}
                    >
                      <span className="flex items-center gap-1 truncate font-semibold">
                        {a.pet_nome}
                        {a.pet_vip && (
                          <span className="rounded-sm bg-ouro px-1 py-px text-[9px] font-bold tracking-wider text-escuro uppercase">
                            VIP
                          </span>
                        )}
                      </span>
                      <span className="block truncate opacity-80">{a.servico_nome}</span>
                      <span className="block font-mono opacity-75">{a.horario.slice(0, 5)}</span>
                    </Link>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isPending && !isError && atendimentos.length === 0 && (
        <p className="mt-4 text-center text-sm text-neutro">Nenhum atendimento nesta semana.</p>
      )}

      {proximos.length > 0 && (
        <div className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl text-escuro">Próximos atendimentos</h2>
              <p className="mt-1 text-xs text-neutro">Desta semana, de hoje em diante</p>
            </div>
            <Link
              to="/atendimentos"
              className="text-sm font-semibold text-marsala hover:underline"
            >
              Ver todos →
            </Link>
          </div>
          <div className="mt-4">
            <AtendimentoTabela atendimentos={proximos} />
          </div>
        </div>
      )}
    </div>
  );
}
