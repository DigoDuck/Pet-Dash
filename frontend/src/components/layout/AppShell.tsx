import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-fundo">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-end border-b border-neutro-light/60 bg-creme px-6">
          <div className="text-right">
            <p className="text-sm font-medium text-escuro">Patricia</p>
            <p className="text-xs text-neutro">Ângelo Spa Animal</p>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
