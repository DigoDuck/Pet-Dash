import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("não renderiza o conteúdo quando fechado", () => {
    render(
      <Modal aberto={false} titulo="Novo tutor" aoFechar={() => {}}>
        <p>conteúdo</p>
      </Modal>,
    );

    expect(screen.queryByText("conteúdo")).not.toBeInTheDocument();
  });

  it("renderiza como dialog com título acessível quando aberto", () => {
    render(
      <Modal aberto titulo="Novo tutor" aoFechar={() => {}}>
        <p>conteúdo</p>
      </Modal>,
    );

    expect(screen.getByRole("dialog", { name: "Novo tutor" })).toBeInTheDocument();
  });

  it("chama aoFechar ao apertar Esc", async () => {
    const aoFechar = vi.fn();
    render(
      <Modal aberto titulo="Novo tutor" aoFechar={aoFechar}>
        <p>conteúdo</p>
      </Modal>,
    );

    await userEvent.keyboard("{Escape}");

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
