import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-fundo">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-neutro-light bg-fundo/85 backdrop-blur">
          <div className="flex items-center justify-end gap-3 px-6 py-4 lg:px-10">
            <div className="text-right">
              <p className="text-sm font-semibold text-escuro">Patricia</p>
              <p className="text-[11px] tracking-wider text-neutro uppercase">Proprietária</p>
            </div>
            <div className="font-display flex h-10 w-10 items-center justify-center rounded-full bg-marsala text-lg text-creme">
              P
            </div>
          </div>
        </header>
        <main className="flex-1 px-6 py-8 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
