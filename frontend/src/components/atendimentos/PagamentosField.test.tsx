import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import type { AtendimentoEntrada } from "../../lib/types";
import { PagamentosField } from "./PagamentosField";

function Host({ valor }: { valor: string }) {
  // Tipar o form: o control precisa ser Control<AtendimentoEntrada> para casar
  // com o PagamentosField (senão o tsc -b quebra o build — os testes entram no include).
  const { control, register, watch } = useForm<AtendimentoEntrada>({
    defaultValues: { pagamentos: [{ metodo: "Pix", valor: "" }] },
  });
  return (
    <PagamentosField control={control} register={register} watch={watch} valorAtendimento={valor} />
  );
}

describe("PagamentosField", () => {
  it("adiciona e remove linhas de pagamento", async () => {
    render(<Host valor="120.00" />);

    expect(screen.getAllByLabelText("Método")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Adicionar pagamento" }));
    expect(screen.getAllByLabelText("Método")).toHaveLength(2);

    await userEvent.click(screen.getAllByRole("button", { name: "Remover" })[0]);
    expect(screen.getAllByLabelText("Método")).toHaveLength(1);
  });

  it("mostra que a soma confere", async () => {
    render(<Host valor="120.00" />);

    await userEvent.type(screen.getAllByLabelText("Valor")[0], "120.00");

    expect(screen.getByText("Soma confere")).toBeInTheDocument();
  });

  it("mostra quanto falta quando a soma não bate", async () => {
    render(<Host valor="120.00" />);

    await userEvent.type(screen.getAllByLabelText("Valor")[0], "80.00");

    expect(screen.getByText(/falta/i)).toHaveTextContent("Falta R$ 40,00");
  });
});
