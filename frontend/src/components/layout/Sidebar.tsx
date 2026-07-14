import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  PawPrint,
  Scissors,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { logout } from "../../lib/api";

interface ItemNav {
  to: string;
  label: string;
  icon: LucideIcon;
}

// Relatórios e Configurações existem no protótipo do Lovable mas seguem fora do MVP.
// A Agenda saiu do backlog a pedido da Patricia (jul/2026).
const navPrincipal: ItemNav[] = [
  { to: "/", label: "Painel financeiro", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/atendimentos", label: "Atendimentos", icon: ClipboardList },
  { to: "/clientes", label: "Clientes & Pets", icon: PawPrint },
  { to: "/servicos", label: "Serviços", icon: Scissors },
];

const navGestao: ItemNav[] = [
  { to: "/pacotes", label: "Pacotes", icon: Package },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
];

function GrupoNav({ titulo, itens }: { titulo: string; itens: ItemNav[] }) {
  return (
    <div className="mt-6 first:mt-0">
      <div className="px-6 pb-2 text-[10px] font-semibold tracking-[0.14em] text-creme/50 uppercase">
        {titulo}
      </div>
      <ul className="space-y-0.5">
        {itens.map(({ to, label, icon: Icone }) => (
          <li key={to}>
            <NavLink
              to={to}
              // Sem `end`, a rota "/" fica ativa em todas as outras (é prefixo de tudo).
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 border-r-2 px-6 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "border-ouro bg-escuro-suave font-semibold text-ouro"
                    : "border-transparent text-creme/75 hover:bg-escuro-suave/60 hover:text-ouro"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icone className="h-4 w-4" strokeWidth={isActive ? 2.25 : 1.75} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  return (
    <aside className="flex w-[260px] flex-col border-r border-escuro-suave bg-escuro text-creme">
      <div className="flex items-center gap-3 border-b border-escuro-suave px-6 py-6">
        {/* A logo é dourada: sempre dentro de um container marsala, nunca em fundo claro. */}
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-marsala">
          <img src="/logo.png" alt="" className="h-9 w-9 object-contain" />
        </div>
        <div>
          <div className="font-display text-[22px] leading-none text-ouro">PetDash</div>
          <div className="mt-1 text-[11px] tracking-wide text-creme/60">Ângelo · Spa Animal</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <GrupoNav titulo="Principal" itens={navPrincipal} />
        <GrupoNav titulo="Gestão" itens={navGestao} />
      </nav>

      <button
        type="button"
        onClick={() => {
          logout();
          navigate("/login");
        }}
        className="m-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-creme/60 transition-colors hover:bg-escuro-suave hover:text-creme"
      >
        <LogOut className="h-4 w-4" strokeWidth={1.75} />
        Sair
      </button>
    </aside>
  );
}
