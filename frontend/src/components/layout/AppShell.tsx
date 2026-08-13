import * as Dialog from "@radix-ui/react-dialog";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const [menuAberto, setMenuAberto] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh bg-fundo">
      <div className="sticky top-0 hidden h-screen w-[260px] shrink-0 lg:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-neutro-light bg-fundo/85 backdrop-blur">
          <div className="flex items-center justify-between px-6 py-4 lg:px-10">
            <Dialog.Root open={menuAberto} onOpenChange={setMenuAberto}>
              <button
                type="button"
                aria-label="Abrir menu"
                className="rounded-lg p-2 text-escuro transition-colors hover:bg-neutro-light/40 lg:hidden"
                onClick={() => setMenuAberto(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <Dialog.Portal>
                <Dialog.Overlay
                  aria-label="Fechar menu"
                  className="fixed inset-0 z-20 bg-escuro/50"
                />
                <Dialog.Content
                  aria-label="Menu"
                  className="fixed inset-y-0 left-0 z-30 w-[260px] max-w-[85vw]"
                >
                  <Sidebar />
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-escuro">Patricia</p>
                <p className="text-[11px] tracking-wider text-neutro uppercase">Proprietária</p>
              </div>
              <div className="font-display flex h-10 w-10 items-center justify-center rounded-full bg-marsala text-lg text-creme">
                P
              </div>
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
