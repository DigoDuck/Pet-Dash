import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { renderizarComProvedores } from "../test/utils";
import { server } from "../test/msw/server";
import { AtendimentoForm } from "./AtendimentoForm";

const BASE = "http://localhost:8000/api";

function servicosOk() {
  return http.get(`${BASE}/servicos/`, () =>
    HttpResponse.json({
      count: 1, next: null, previous: null,
      results: [{
        id: 1, nome: "Banho", preco_padrao: "60.00", preco_m: null, preco_g: null,
        is_pacote: false, creditos: null, ativo: true,
      }],
    }),
  );
}

/** Catálogo com as três faixas da Patricia: 65 até 10kg, 120 de 10 a 15kg, 150 acima. */
function servicosComFaixas() {
  return http.get(`${BASE}/servicos/`, () =>
    HttpResponse.json({
      count: 1, next: null, previous: null,
      results: [{
        id: 1, nome: "Banho", preco_padrao: "65.00", preco_m: "120.00", preco_g: "150.00",
        is_pacote: false, creditos: null, ativo: true,
      }],
    }),
  );
}

function petsOk(porte = "", flags: Partial<Record<"agressivo" | "otite" | "problema_pele", boolean>> = {}) {
  return http.get(`${BASE}/pets/`, () =>
    HttpResponse.json({
      count: 1, next: null, previous: null,
      results: [{
        id: 7, tutor: 1, tutor_nome: "Ana Clara", nome: "Luna", raca: "", porte,
        ativo: true, created_at: "", vip: false, qtd_visitas: 0, total_gasto: "0.00",
        agressivo: false, otite: false, problema_pele: false, ...flags,
      }],
    }),
  );
}

async function escolherLuna() {
  await userEvent.type(screen.getByLabelText("Pet"), "Luna");
  await waitFor(() => expect(screen.getByText("Luna · Ana Clara")).toBeInTheDocument());
  await userEvent.click(screen.getByText("Luna · Ana Clara"));
}

describe("AtendimentoForm", () => {
  it("escolher serviço pré-preenche o valor com o preço de referência", async () => {
    server.use(servicosOk(), petsOk());

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });

    // Esperar a option carregar via MSW antes de selecionar (senão "value not found").
    await screen.findByRole("option", { name: "Banho" });
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "1");

    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("60.00"));
  });

  // A Patricia cobra por faixa de peso. Sugerir sempre o preço do pequeno faria ela
  // cobrar R$ 65 de um Golden que custa R$ 150 — todo dia, sem nenhum erro na tela.
  it("sugere o preço da faixa de peso do pet", async () => {
    server.use(servicosComFaixas(), petsOk("G"));

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await escolherLuna();
    await screen.findByRole("option", { name: "Banho" });

    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "1");

    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("150.00"));
  });

  it("faixa sem preço próprio cai no preço do pequeno", async () => {
    // Hidratação custa 30 e a Patricia não deu preço de grande: sugerir 30 (baixo, ela
    // corrige) é melhor do que deixar o campo vazio ou inventar um número.
    server.use(
      http.get(`${BASE}/servicos/`, () =>
        HttpResponse.json({
          count: 1, next: null, previous: null,
          results: [{
            id: 1, nome: "Hidratação", preco_padrao: "30.00", preco_m: null, preco_g: null,
            is_pacote: false, creditos: null, ativo: true,
          }],
        }),
      ),
      petsOk("G"),
    );

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await escolherLuna();
    await screen.findByRole("option", { name: "Hidratação" });

    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "1");

    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("30.00"));
  });

  it("manejo especial acrescenta 40% à sugestão", async () => {
    server.use(servicosComFaixas(), petsOk("P"));

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await escolherLuna();
    await screen.findByRole("option", { name: "Banho" });
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "1");
    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("65.00"));

    await userEvent.click(screen.getByLabelText(/Manejo especial/));

    // 65 × 1,4 = 91. É sugestão: ela edita por cima se cobrar outro valor.
    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("91.00"));
  });

  // --- Modo edição -------------------------------------------------------------
  //
  // Nenhum destes caminhos tinha teste. O form de edição reusava a lógica de criação:
  // recalculava o vínculo do pacote pelo pacote-ativo DE HOJE e re-sugeria o preço no
  // mount. Os dois corrompiam dado histórico numa ação rotineira (abrir e salvar).

  function atendimentoExistente(over: Record<string, unknown> = {}) {
    return {
      id: 42, pet: 7, pet_nome: "Luna", tutor_nome: "Ana Clara",
      servico: 1, servico_nome: "Banho", pacote: null,
      data: "2026-06-25", horario: "10:00:00", valor: "150.00",
      transporte: false, transporte_valor: "0.00", manejo_especial: false,
      status: "Liberado", pagamentos: [{ id: 1, metodo: "Pix", valor: "150.00" }],
      ...over,
    };
  }

  function renderizarEdicao() {
    return renderizarComProvedores(<AtendimentoForm />, {
      rota: "/atendimentos/42/editar",
      caminho: "/atendimentos/:id/editar",
    });
  }

  // Invariante 7: `Atendimento.valor` é o snapshot do que foi cobrado no dia. Abrir a
  // edição não pode reescrevê-lo com o preço do catálogo — a Patricia vem corrigir o
  // horário e sai gravando R$ 65 num banho de Golden que custou R$ 150.
  it("abrir a edição preserva o valor cobrado, não sugere o preço do catálogo", async () => {
    server.use(
      servicosComFaixas(),
      petsOk("G"),
      http.get(`${BASE}/atendimentos/42/`, () => HttpResponse.json(atendimentoExistente())),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () => new HttpResponse(null, { status: 204 })),
    );

    renderizarEdicao();

    // Espera o registro hidratar o form...
    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("150.00"));
    // ...e o catálogo carregar, que é o gatilho da sugestão. Se algum efeito ainda
    // sugerir preço na edição, é aqui que o valor histórico vira R$ 65,00.
    await screen.findByRole("option", { name: "Banho" });
    await new Promise((r) => setTimeout(r, 50));

    expect(screen.getByLabelText("Valor do serviço")).toHaveValue("150.00");
  });

  // Invariante 1: o consumo de pacote é excluído do faturamento pelo `pacote_id`.
  // Desvincular no PATCH transforma o banho em avulso e fatura de novo um dinheiro que
  // já entrou na venda do pacote.
  it("editar um consumo de pacote sem saldo preserva o vínculo com o pacote", async () => {
    let enviado: Record<string, unknown> | null = null;
    server.use(
      servicosComFaixas(),
      petsOk("P"),
      http.get(`${BASE}/atendimentos/42/`, () =>
        HttpResponse.json(atendimentoExistente({ pacote: 3, pagamentos: [] })),
      ),
      // O pacote está esgotado: é o 4º banho dele. É o caso mais comum de edição —
      // liberar o último banho do mês.
      http.get(`${BASE}/pets/7/pacote-ativo/`, () =>
        HttpResponse.json({
          id: 3, pet: 7, servico: 1, competencia: "2026-06-01", qtd_total: 4,
          valor_pago: "290.00", data_compra: "2026-06-01", validade: "2026-06-30", saldo: 0,
        }),
      ),
      http.patch(`${BASE}/atendimentos/42/`, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 42 });
      }),
    );

    renderizarEdicao();
    await screen.findByDisplayValue("2026-06-25");

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(enviado).not.toBeNull());
    expect(enviado!.pacote).toBe(3);
  });

  // Editar um avulso de um pet que HOJE tem pacote com saldo vinculava o atendimento
  // antigo ao pacote novo e, de quebra, apagava os pagamentos (o update do serializer
  // recria as linhas a partir do payload).
  it("editar um avulso não o vincula ao pacote atual nem apaga os pagamentos", async () => {
    let enviado: Record<string, unknown> | null = null;
    server.use(
      servicosComFaixas(),
      petsOk("P"),
      http.get(`${BASE}/atendimentos/42/`, () => HttpResponse.json(atendimentoExistente())),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () =>
        HttpResponse.json({
          id: 9, pet: 7, servico: 1, competencia: "2026-07-01", qtd_total: 4,
          valor_pago: "290.00", data_compra: "2026-07-01", validade: "2026-07-31", saldo: 3,
        }),
      ),
      http.patch(`${BASE}/atendimentos/42/`, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 42 });
      }),
    );

    renderizarEdicao();
    await screen.findByDisplayValue("2026-06-25");

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(enviado).not.toBeNull());
    expect(enviado!.pacote).toBeNull();
    expect(enviado!.pagamentos).toHaveLength(1);
  });

  it("pet com pacote vincula e esconde os pagamentos", async () => {
    server.use(
      servicosOk(),
      petsOk(),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () =>
        HttpResponse.json({
          id: 3, pet: 7, servico: 1, competencia: "2026-07-01", qtd_total: 4,
          valor_pago: "220.00", data_compra: "2026-07-01", validade: "2026-07-31", saldo: 3,
        }),
      ),
    );

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await escolherLuna();

    expect(await screen.findByText("Pacote Fidelidade vinculado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar pagamento" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Alertas deste pet/i)).not.toBeInTheDocument();
  });

  it("'cobrar como avulso' desvincula e revela os pagamentos", async () => {
    server.use(
      servicosOk(),
      petsOk(),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () =>
        HttpResponse.json({
          id: 3, pet: 7, servico: 1, competencia: "2026-07-01", qtd_total: 4,
          valor_pago: "220.00", data_compra: "2026-07-01", validade: "2026-07-31", saldo: 3,
        }),
      ),
    );

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await escolherLuna();
    await screen.findByText("Pacote Fidelidade vinculado");

    await userEvent.click(screen.getByRole("button", { name: "Cobrar como avulso" }));

    expect(screen.getByRole("button", { name: "Adicionar pagamento" })).toBeInTheDocument();
    expect(screen.queryByText("Pacote Fidelidade vinculado")).not.toBeInTheDocument();
  });

  it("pet com pacote saldo 0 cai em avulso com aviso", async () => {
    server.use(
      servicosOk(),
      petsOk(),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () =>
        HttpResponse.json({
          id: 3, pet: 7, servico: 1, competencia: "2026-07-01", qtd_total: 4,
          valor_pago: "220.00", data_compra: "2026-07-01", validade: "2026-07-31", saldo: 0,
        }),
      ),
    );

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await escolherLuna();

    expect(await screen.findByText(/sem saldo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar pagamento" })).toBeInTheDocument();
  });

  // O flag do pet é o motivo de o PR existir: ela não pode depender de lembrar que o
  // Thor morde. Pré-marcar sem trazer os 40% junto seria pior que não pré-marcar —
  // o checkbox diria "+40%" e o valor sugerido estaria sem eles.
  it("pet cadastrado como agressivo pré-marca o manejo e já sugere com os 40%", async () => {
    server.use(
      servicosComFaixas(),
      petsOk("P", { agressivo: true }),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () => new HttpResponse(null, { status: 204 })),
    );

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await screen.findByRole("option", { name: "Banho" });
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "1");
    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("65.00"));

    await escolherLuna();

    expect(await screen.findByText(/cadastrado como agressivo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Manejo especial/)).toBeChecked();
    // 65 × 1,4 = 91. Se `sugerirValor` receber o `manejoEspecial` velho do watch, fica 65.
    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("91.00"));
  });

  it("otite e problema de pele avisam sem tocar no manejo nem no valor", async () => {
    server.use(
      servicosComFaixas(),
      petsOk("P", { otite: true, problema_pele: true }),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () => new HttpResponse(null, { status: 204 })),
    );

    renderizarComProvedores(<AtendimentoForm />, { rota: "/atendimentos/novo", caminho: "/atendimentos/novo" });
    await screen.findByRole("option", { name: "Banho" });
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "1");
    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("65.00"));

    await escolherLuna();

    expect(await screen.findByText(/otite/i)).toBeInTheDocument();
    expect(screen.getByText(/problema de pele/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Manejo especial/)).not.toBeChecked();
    expect(screen.getByLabelText("Valor do serviço")).toHaveValue("65.00");
  });

  // Invariante 7 de novo, pelo caminho novo. Ela abre um atendimento antigo de pet
  // agressivo em que cobrou sem acréscimo; pré-marcar aqui marcaria o checkbox e
  // reescreveria o valor histórico numa ação que era só "corrigir o horário".
  it("abrir a edição de pet agressivo não marca o manejo nem mexe no valor", async () => {
    server.use(
      servicosComFaixas(),
      petsOk("G", { agressivo: true }),
      http.get(`${BASE}/atendimentos/42/`, () => HttpResponse.json(atendimentoExistente())),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () => new HttpResponse(null, { status: 204 })),
    );

    renderizarEdicao();

    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("150.00"));
    await screen.findByRole("option", { name: "Banho" });
    await new Promise((r) => setTimeout(r, 50));

    expect(screen.getByLabelText(/Manejo especial/)).not.toBeChecked();
    expect(screen.getByLabelText("Valor do serviço")).toHaveValue("150.00");
    expect(screen.queryByText(/cadastrado como agressivo/i)).not.toBeInTheDocument();
  });

  // Achado 1 (revisão PR 20 Task 3): o Combobox de Pet não é desabilitado na edição, e
  // `escolherPet` reescrevia manejo_especial e valor mesmo lá. Ela abre um atendimento
  // antigo só para corrigir o vínculo do pet — reencostar no campo não pode remarcar o
  // checkbox nem trazer o preço do catálogo por cima do que já foi cobrado.
  it("reselecionar o pet na edição não marca o manejo nem reescreve o valor histórico", async () => {
    server.use(
      servicosComFaixas(),
      petsOk("G", { agressivo: true }),
      http.get(`${BASE}/atendimentos/42/`, () => HttpResponse.json(atendimentoExistente())),
      http.get(`${BASE}/pets/7/pacote-ativo/`, () => new HttpResponse(null, { status: 204 })),
    );

    renderizarEdicao();

    // Espera o registro hidratar o form e o catálogo carregar antes de reencostar no Pet.
    await waitFor(() => expect(screen.getByLabelText("Valor do serviço")).toHaveValue("150.00"));
    await screen.findByRole("option", { name: "Banho" });

    await escolherLuna();

    expect(screen.getByLabelText(/Manejo especial/)).not.toBeChecked();
    expect(screen.getByLabelText("Valor do serviço")).toHaveValue("150.00");
  });
});
