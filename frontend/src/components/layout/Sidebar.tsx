import { NavLink, useNavigate } from "react-router-dom";
import { logout } from "../../lib/api";

const itens = [
  { to: "/", label: "Dashboard" },
  { to: "/clientes", label: "Clientes & Pets" },
  { to: "/servicos", label: "Serviços" },
  { to: "/atendimentos", label: "Atendimentos" },
  { to: "/pacotes", label: "Pacotes" },
  { to: "/financeiro", label: "Financeiro" },
];

export function Sidebar() {
  const navigate = useNavigate();
  return (
    <aside className="flex w-60 flex-col bg-marsala text-creme">
      <div className="flex items-center gap-3 p-5">
        <img src="/logo.png" alt="" className="h-10" />
        <span className="font-display text-xl">PetDash</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {itens.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-marsala-dark font-medium text-ouro-light"
                  : "text-creme/80 hover:bg-marsala-light/40"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => {
          logout();
          navigate("/login");
        }}
        className="m-3 rounded-lg px-3 py-2 text-left text-sm text-creme/70 transition-colors hover:bg-marsala-light/40"
      >
        Sair
      </button>
    </aside>
  );
}
