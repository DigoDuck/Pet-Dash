import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Sidebar } from "./Sidebar";

function renderSidebar(rota: string) {
  const router = createMemoryRouter([{ path: "*", element: <Sidebar /> }], {
    initialEntries: [rota],
  });
  render(<RouterProvider router={router} />);
}

describe("Sidebar", () => {
  it("lista os 7 itens do app", () => {
    renderSidebar("/");
    for (const label of [
      "Painel financeiro",
      "Agenda",
      "Atendimentos",
      "Clientes & Pets",
      "Serviços",
      "Pacotes",
      "Financeiro",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("link")).toHaveLength(7);
  });

  // A Agenda saiu do backlog a pedido da Patricia (jul/2026). Relatórios e Configurações
  // continuam no protótipo e fora do escopo.
  it("não mostra os itens fora de escopo que existem no protótipo", () => {
    renderSidebar("/");
    for (const fora of ["Relatórios", "Configurações"]) {
      expect(screen.queryByRole("link", { name: fora })).not.toBeInTheDocument();
    }
  });

  it("marca o Painel financeiro como ativo na raiz", () => {
    renderSidebar("/");
    expect(screen.getByRole("link", { name: "Painel financeiro" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("não deixa o Painel financeiro ativo em outra rota (prop `end`)", () => {
    renderSidebar("/atendimentos");
    expect(screen.getByRole("link", { name: "Painel financeiro" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Atendimentos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
