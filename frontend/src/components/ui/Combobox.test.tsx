import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Combobox } from "./Combobox";

const ITENS = [
  { id: 7, rotulo: "Luna · Ana Clara" },
  { id: 8, rotulo: "Thor · Ana Clara" },
];

const RETANGULO_PROXIMO_AO_TECLADO = {
  bottom: 540,
  height: 40,
  left: 20,
  right: 320,
  toJSON: () => ({}),
  top: 500,
  width: 300,
  x: 20,
  y: 500,
};

afterEach(() => {
  vi.restoreAllMocks();
});

function ComboboxComValorSelecionado() {
  const [valor, setValor] = useState<(typeof ITENS)[number] | null>(null);

  return (
    <>
      <Combobox
        label="Pet"
        itens={ITENS}
        valor={valor}
        aoSelecionar={setValor}
        aoDigitarBusca={() => {}}
      />
      <p>Selecionado: {valor?.rotulo ?? "nenhum"}</p>
    </>
  );
}

describe("Combobox", () => {
  it("emite o termo digitado", async () => {
    const aoDigitarBusca = vi.fn();
    render(
      <Combobox label="Pet" itens={[]} valor={null} aoSelecionar={vi.fn()} aoDigitarBusca={aoDigitarBusca} />,
    );

    await userEvent.type(screen.getByLabelText("Pet"), "Lu");

    expect(aoDigitarBusca).toHaveBeenCalledWith("Lu");
  });

  it("seleciona um item pelo clique", async () => {
    const aoSelecionar = vi.fn();
    render(
      <Combobox label="Pet" itens={ITENS} valor={null} aoSelecionar={aoSelecionar} aoDigitarBusca={vi.fn()} />,
    );

    await userEvent.click(screen.getByLabelText("Pet"));
    await userEvent.click(screen.getByText("Luna · Ana Clara"));

    expect(aoSelecionar).toHaveBeenCalledWith({ id: 7, rotulo: "Luna · Ana Clara" });
  });

  it("porta a lista para fora da raiz e mantém a seleção por clique", async () => {
    const user = userEvent.setup();
    const { container } = render(<ComboboxComValorSelecionado />);

    await user.click(screen.getByLabelText("Pet"));

    const lista = screen.getByRole("listbox");
    expect(container).not.toContainElement(lista);

    await user.click(screen.getByRole("option", { name: "Luna · Ana Clara" }));

    expect(screen.getByText("Selecionado: Luna · Ana Clara")).toBeInTheDocument();
  });

  it("abre a lista acima do campo quando o teclado deixa pouco espaço abaixo", async () => {
    const alturaOriginal = window.innerHeight;
    const viewportVisualOriginal = Object.getOwnPropertyDescriptor(window, "visualViewport");

    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        height: 600,
        removeEventListener: vi.fn(),
      } satisfies Pick<VisualViewport, "addEventListener" | "height" | "removeEventListener">,
    });
    vi.spyOn(HTMLInputElement.prototype, "getBoundingClientRect").mockReturnValue(
      RETANGULO_PROXIMO_AO_TECLADO,
    );

    try {
      const user = userEvent.setup();
      render(<Combobox label="Pet" itens={ITENS} valor={null} aoSelecionar={vi.fn()} aoDigitarBusca={vi.fn()} />);

      await user.click(screen.getByLabelText("Pet"));

      expect(screen.getByRole("listbox")).toHaveStyle({
        bottom: "104px",
        maxHeight: "240px",
      });
    } finally {
      Object.defineProperty(window, "innerHeight", { configurable: true, value: alturaOriginal });
      if (viewportVisualOriginal) {
        Object.defineProperty(window, "visualViewport", viewportVisualOriginal);
      } else {
        delete (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
      }
    }
  });

  // Com o teclado aberto os dois lados ficam apertados. Decidir só por "cabem 240px
  // abaixo?" mandava a lista para o lado MENOR: 116px acima quando havia 236px abaixo,
  // ou seja, metade das opções que caberiam.
  it("fica abaixo quando nenhum lado comporta a lista mas abaixo sobra mais", async () => {
    const viewportVisualOriginal = Object.getOwnPropertyDescriptor(window, "visualViewport");

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        height: 400,
        removeEventListener: vi.fn(),
      } satisfies Pick<VisualViewport, "addEventListener" | "height" | "removeEventListener">,
    });
    vi.spyOn(HTMLInputElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 160,
      height: 40,
      left: 20,
      right: 220,
      toJSON: () => ({}),
      top: 120,
      width: 200,
      x: 20,
      y: 120,
    });

    try {
      const user = userEvent.setup();
      render(<Combobox label="Pet" itens={ITENS} valor={null} aoSelecionar={vi.fn()} aoDigitarBusca={vi.fn()} />);

      await user.click(screen.getByLabelText("Pet"));

      // 236px abaixo contra 116px acima: fica embaixo, limitada ao que sobra.
      expect(screen.getByRole("listbox")).toHaveStyle({
        top: "164px",
        maxHeight: "236px",
      });
    } finally {
      if (viewportVisualOriginal) {
        Object.defineProperty(window, "visualViewport", viewportVisualOriginal);
      } else {
        delete (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
      }
    }
  });

  it("limita a altura ao espaço útil quando abre para cima", async () => {
    const viewportVisualOriginal = Object.getOwnPropertyDescriptor(window, "visualViewport");

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        height: 300,
        removeEventListener: vi.fn(),
      } satisfies Pick<VisualViewport, "addEventListener" | "height" | "removeEventListener">,
    });
    vi.spyOn(HTMLInputElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 190,
      height: 40,
      left: 20,
      right: 220,
      toJSON: () => ({}),
      top: 150,
      width: 200,
      x: 20,
      y: 150,
    });

    try {
      const user = userEvent.setup();
      render(<Combobox label="Pet" itens={ITENS} valor={null} aoSelecionar={vi.fn()} aoDigitarBusca={vi.fn()} />);

      await user.click(screen.getByLabelText("Pet"));

      // 106px abaixo contra 146px acima: vira para cima e a altura cai para os 146.
      expect(screen.getByRole("listbox")).toHaveStyle({
        bottom: "154px",
        maxHeight: "146px",
      });
    } finally {
      if (viewportVisualOriginal) {
        Object.defineProperty(window, "visualViewport", viewportVisualOriginal);
      } else {
        delete (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
      }
    }
  });

  it("seleciona com teclado (seta + enter)", async () => {
    const aoSelecionar = vi.fn();
    render(
      <Combobox label="Pet" itens={ITENS} valor={null} aoSelecionar={aoSelecionar} aoDigitarBusca={vi.fn()} />,
    );

    const input = screen.getByLabelText("Pet");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(aoSelecionar).toHaveBeenCalledWith({ id: 8, rotulo: "Thor · Ana Clara" });
  });

  it("mostra o rótulo do valor selecionado", () => {
    render(
      <Combobox
        label="Pet"
        itens={[]}
        valor={{ id: 7, rotulo: "Luna · Ana Clara" }}
        aoSelecionar={vi.fn()}
        aoDigitarBusca={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Pet")).toHaveValue("Luna · Ana Clara");
  });
});
