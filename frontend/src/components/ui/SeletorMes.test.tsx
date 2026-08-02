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
  // ou "-01" na query). Nada sobe, e o campo volta sozinho ao último mês válido.
  //
  // O "volta" acontece no blur, e não na tecla: reescrever o valor a cada tecla é o
  // que travava o campo no Firefox, onde não há picker e o mês é digitado caractere
  // a caractere. (O caminho do Firefox não dá para exercitar aqui — o jsdom
  // implementa <input type="month"> e higieniza "2026-0" para "" antes de chegar ao
  // handler; o Firefox nem implementa o tipo, cai para texto puro.)
  it("ignora o campo esvaziado e volta ao último mês válido no blur", () => {
    const aoMudar = vi.fn();
    render(<SeletorMes valor="2026-07" aoMudar={aoMudar} />);
    const campo = screen.getByLabelText("Mês");

    fireEvent.change(campo, { target: { value: "" } });
    expect(aoMudar).not.toHaveBeenCalled();
    expect(campo).toHaveValue("");

    fireEvent.blur(campo);
    expect(campo).toHaveValue("2026-07");
  });

  it("ignora mês incompleto", () => {
    const aoMudar = vi.fn();
    render(<SeletorMes valor="2026-07" aoMudar={aoMudar} />);

    fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "2026" } });

    expect(aoMudar).not.toHaveBeenCalled();
  });

  // As setas são o único caminho de troca de mês que funciona sem picker — no
  // Firefox, sem elas, sobra digitar "2026-07" na mão. Virada de ano incluída.
  it("anda um mês para trás e para a frente pelas setas", () => {
    const aoMudar = vi.fn();
    render(<SeletorMes valor="2026-01" aoMudar={aoMudar} />);

    fireEvent.click(screen.getByLabelText("Mês anterior"));
    expect(aoMudar).toHaveBeenCalledWith("2025-12");

    fireEvent.click(screen.getByLabelText("Próximo mês"));
    expect(aoMudar).toHaveBeenCalledWith("2026-02");
  });

  it("aceita um rótulo próprio", () => {
    render(<SeletorMes valor="2026-07" aoMudar={vi.fn()} label="Competência" />);

    expect(screen.getByLabelText("Competência")).toBeInTheDocument();
  });
});
