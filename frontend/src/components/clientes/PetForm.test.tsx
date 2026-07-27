import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderizarComProvedores } from "../../test/utils";
import { PetForm } from "./PetForm";

describe("PetForm", () => {
  it("envia as três condições marcadas", async () => {
    const aoSalvar = vi.fn();

    renderizarComProvedores(
      <PetForm tutorId={3} aoSalvar={aoSalvar} enviando={false} aoCancelar={() => {}} />,
    );

    await userEvent.type(screen.getByLabelText("Nome"), "Thor");
    await userEvent.click(screen.getByLabelText(/agressivo/i));
    await userEvent.click(screen.getByLabelText(/otite/i));
    await userEvent.click(screen.getByLabelText(/problema de pele/i));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    expect(aoSalvar.mock.calls[0][0]).toMatchObject({
      tutor: 3,
      nome: "Thor",
      agressivo: true,
      otite: true,
      problema_pele: true,
    });
  });

  // Sem os três no defaultValues, o React troca input não-controlado por controlado ao
  // editar um pet antigo, e o payload sai com `undefined` no lugar de `false`.
  it("pet sem condições envia false, nunca undefined", async () => {
    const aoSalvar = vi.fn();

    renderizarComProvedores(
      <PetForm tutorId={3} aoSalvar={aoSalvar} enviando={false} aoCancelar={() => {}} />,
    );

    await userEvent.type(screen.getByLabelText("Nome"), "Luna");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    expect(aoSalvar.mock.calls[0][0]).toMatchObject({
      agressivo: false,
      otite: false,
      problema_pele: false,
    });
  });

  // A ficha do pet passa `inicial`; se um campo faltar ali, o PATCH manda `false` e
  // apaga em silêncio a condição que já estava gravada.
  it("respeita os flags recebidos em `inicial`", async () => {
    const aoSalvar = vi.fn();

    renderizarComProvedores(
      <PetForm
        tutorId={3}
        inicial={{ nome: "Thor", raca: "Pastor", porte: "G", agressivo: true, otite: false, problema_pele: true }}
        aoSalvar={aoSalvar}
        enviando={false}
        aoCancelar={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    expect(aoSalvar.mock.calls[0][0]).toMatchObject({
      agressivo: true,
      otite: false,
      problema_pele: true,
    });
  });
});
