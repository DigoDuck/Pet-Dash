import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { Atendimento } from "../../lib/types";
import { server } from "../../test/msw/server";
import { renderizarComProvedores } from "../../test/utils";
import { StatusAcao } from "./StatusAcao";

const BASE = "http://localhost:8000/api";

const pendente: Atendimento = {
  id: 5, pet: 7, pet_nome: "Luna", tutor_nome: "Ana Clara", pet_vip: false,
  servico: 1, servico_nome: "Banho", pacote: null, data: "2026-09-29", horario: "10:00:00",
  valor: "65.00", transporte: false, transporte_valor: "0.00", manejo_especial: false,
  status: "Pendente", pagamentos: [],
};

describe("StatusAcao", () => {
  // Com o 4G do balcão caindo, o Liberar voltava ao normal e ela achava que tinha
  // liberado. E o erro reaparecia depois, dentro do diálogo de Cancelar.
  it("Liberar que falha avisa na linha e não contamina o diálogo de Cancelar", async () => {
    server.use(
      http.patch(`${BASE}/atendimentos/5/`, () => HttpResponse.json({}, { status: 500 })),
    );

    renderizarComProvedores(<StatusAcao atendimento={pendente} />);
    await userEvent.click(screen.getByRole("button", { name: "Liberar" }));

    expect(await screen.findByText(/Não liberou/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    const dialogo = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialogo).queryByRole("alert")).not.toBeInTheDocument());
  });
});
