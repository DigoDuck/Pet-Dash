import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Paginacao } from "./Paginacao";

describe("Paginacao", () => {
  it("não renderiza nada quando cabe em uma página", () => {
    const { container } = render(<Paginacao pagina={1} count={12} aoMudar={() => {}} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("mostra a página atual e o total", () => {
    render(<Paginacao pagina={2} count={120} aoMudar={() => {}} />);

    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
  });

  it("desabilita Anterior na primeira e Próxima na última", () => {
    const { rerender } = render(<Paginacao pagina={1} count={120} aoMudar={() => {}} />);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    rerender(<Paginacao pagina={3} count={120} aoMudar={() => {}} />);
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });

  it("avança de página", async () => {
    const aoMudar = vi.fn();
    render(<Paginacao pagina={1} count={120} aoMudar={aoMudar} />);

    await userEvent.click(screen.getByRole("button", { name: "Próxima" }));

    expect(aoMudar).toHaveBeenCalledWith(2);
  });
});
