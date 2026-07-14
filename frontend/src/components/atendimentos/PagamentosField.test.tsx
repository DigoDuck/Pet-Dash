import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import type { AtendimentoEntrada } from "../../lib/types";
import { PagamentosField } from "./PagamentosField";

function Host({ devido }: { devido: number }) {
  // Tipar o form: o control precisa ser Control<AtendimentoEntrada> para casar
  // com o PagamentosField (senão o tsc -b quebra o build — os testes entram no include).
  const { control, register, watch } = useForm<AtendimentoEntrada>({
    defaultValues: { pagamentos: [{ metodo: "Pix", valor: "" }] },
  });
  return (
    <PagamentosField control={control} register={register} watch={watch} valorDevido={devido} />
  );
}

describe("PagamentosField", () => {
  it("adiciona e remove linhas de pagamento", async () => {
    render(<Host devido={120} />);

    expect(screen.getAllByLabelText("Método")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Adicionar pagamento" }));
    expect(screen.getAllByLabelText("Método")).toHaveLength(2);

    await userEvent.click(screen.getAllByRole("button", { name: "Remover" })[0]);
    expect(screen.getAllByLabelText("Método")).toHaveLength(1);
  });

  it("mostra que a soma confere", async () => {
    render(<Host devido={120} />);

    await userEvent.type(screen.getAllByLabelText("Valor")[0], "120.00");

    expect(screen.getByText("Soma confere")).toBeInTheDocument();
  });

  it("mostra quanto falta quando a soma não bate", async () => {
    render(<Host devido={120} />);

    await userEvent.type(screen.getAllByLabelText("Valor")[0], "80.00");

    expect(screen.getByText(/falta/i)).toHaveTextContent("Falta R$ 40,00");
  });

  // O alvo é serviço + corrida, não só o serviço: sem o total explícito, a Patricia
  // lança os R$ 65 do banho e não entende por que ainda "falta R$ 20,00".
  it("o alvo inclui o transporte e aparece na tela", async () => {
    render(<Host devido={85} />);

    expect(screen.getByText("Total a cobrar:").parentElement).toHaveTextContent("R$ 85,00");

    await userEvent.type(screen.getAllByLabelText("Valor")[0], "65.00");

    expect(screen.getByText(/falta/i)).toHaveTextContent("Falta R$ 20,00");
  });
});
