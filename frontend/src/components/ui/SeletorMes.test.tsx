import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeletorMes } from "./SeletorMes";

describe("SeletorMes", () => {
  it("entrega o mês quando ele está completo", () => {
    const aoMudar = vi.fn();
    render(<SeletorMes valor="2026-07" aoMudar={aoMudar} />);

    fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "2026-06" } });

    expect(aoMudar).toHaveBeenCalledWith("2026-06");
  });

  // Limpar o campo emite "": quem consome quebraria (RangeError no ultimoDiaDoMes,
  // ou "-01" na query). O componente segura, e o input volta ao mês anterior.
  it("ignora o campo esvaziado e mantém o último mês válido", () => {
    const aoMudar = vi.fn();
    render(<SeletorMes valor="2026-07" aoMudar={aoMudar} />);

    fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "" } });

    expect(aoMudar).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Mês")).toHaveValue("2026-07");
  });

  it("ignora mês incompleto", () => {
    const aoMudar = vi.fn();
    render(<SeletorMes valor="2026-07" aoMudar={aoMudar} />);

    fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "2026" } });

    expect(aoMudar).not.toHaveBeenCalled();
  });

  it("aceita um rótulo próprio", () => {
    render(<SeletorMes valor="2026-07" aoMudar={vi.fn()} label="Competência" />);

    expect(screen.getByLabelText("Competência")).toBeInTheDocument();
  });
});
