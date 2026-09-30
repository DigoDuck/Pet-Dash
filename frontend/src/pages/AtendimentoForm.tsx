import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { AlertasDoPet } from "../components/atendimentos/AlertasDoPet";
import { OrigemAtendimento } from "../components/atendimentos/OrigemAtendimento";
import { PagamentosField } from "../components/atendimentos/PagamentosField";
import { Button } from "../components/ui/Button";
import { Checkbox } from "../components/ui/Checkbox";
import { Combobox } from "../components/ui/Combobox";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import {
  useAtendimento,
  useAtualizarAtendimento,
  useCriarAtendimento,
} from "../hooks/useAtendimentos";
import { usePacoteAtivo } from "../hooks/usePacoteAtivo";
import { useBuscaPets } from "../hooks/usePets";
import { useServicos } from "../hooks/useServicos";
import { mensagemDeErro } from "../lib/api";
import { hojeISO } from "../lib/competencia";
import { normalizarDecimal, paraNumero } from "../lib/dinheiro";
import { ACRESCIMO_MANEJO, precoParaPorte, type AtendimentoEntrada, type Porte } from "../lib/types";

const GRUPO = "flex min-w-0 flex-col gap-4";
const DIVISOR = "border-t border-neutro-light/60 pt-6";
const LEGENDA = "mb-4 font-display text-xl text-escuro";

const VAZIO: AtendimentoEntrada = {
  pet: 0, servico: 0, pacote: null, data: "", horario: "", valor: "",
  transporte: false, transporte_valor: "0.00", manejo_especial: false,
  status: "Pendente", pagamentos: [],
};

export function AtendimentoForm() {
  const { id } = useParams();
  const editando = id != null;
  const navigate = useNavigate();

  const [textoPet, setTextoPet] = useState("");
  const [termoPet, setTermoPet] = useState("");
  // O porte viaja junto com o pet selecionado, capturado no momento da escolha. Olhar
  // `buscaPets` na hora de sugerir o preço não serviria: o termo da busca muda, a
  // lista de resultados muda, e o pet escolhido some dela — o porte viraria "".
  const [petSelecionado, setPetSelecionado] = useState<{
    id: number;
    rotulo: string;
    porte: Porte;
    agressivo: boolean;
    otite: boolean;
    problema_pele: boolean;
  } | null>(null);
  const [cobrarAvulso, setCobrarAvulso] = useState(false);

  // Debounce da busca de pet (300ms), como em Clientes/Servicos: sem isto cada
  // tecla dispara um GET /pets/?search=.
  useEffect(() => {
    const t = setTimeout(() => setTermoPet(textoPet), 300);
    return () => clearTimeout(t);
  }, [textoPet]);

  const { register, handleSubmit, control, watch, setValue, reset, formState } =
    useForm<AtendimentoEntrada>({ defaultValues: VAZIO });

  // O pacote é procurado na data do ATENDIMENTO, não na de hoje. A Patricia lança com
  // atraso (vem de planilha): em 1º de julho, o banho de 30 de junho tem que achar o
  // pacote que valia em 30 de junho. E é a data, não o mês, porque a validade estendida
  // (reagendamento) faz o pacote de setembro valer em outubro. Sem data, vale hoje: é o
  // default que o backend grava.
  const dataConsulta = watch("data") || hojeISO();

  const buscaPets = useBuscaPets(termoPet);
  const pacoteAtivo = usePacoteAtivo(petSelecionado?.id ?? null, dataConsulta);
  const servicos = useServicos("", false);
  const criar = useCriarAtendimento();
  const existente = useAtendimento(editando ? Number(id) : 0);
  const atualizar = useAtualizarAtendimento(editando ? Number(id) : 0);

  // Preenche o form ao editar.
  useEffect(() => {
    if (existente.data) {
      reset({
        ...existente.data,
        pagamentos: existente.data.pagamentos.map((p) => ({ metodo: p.metodo, valor: p.valor })),
      });
      // Ao editar, o porte não vem no payload do atendimento. Fica "" e a sugestão de
      // preço cai na faixa do pequeno — o que não importa: o `valor` já foi carregado
      // do registro, e a sugestão só sobrescreve se ela trocar o serviço.
      //
      // Na edição os flags ficam em `false` de propósito: o payload do atendimento não os
      // traz, e o banner é ferramenta de decisão na criação. Igual ao OrigemAtendimento,
      // que também só existe lá.
      setPetSelecionado({
        id: existente.data.pet,
        rotulo: existente.data.pet_nome,
        porte: "",
        agressivo: false,
        otite: false,
        problema_pele: false,
      });
    }
  }, [existente.data, reset]);

  const pacote = pacoteAtivo.data ?? null;
  const temSaldo = pacote != null && pacote.saldo > 0;
  const transporte = watch("transporte");
  const valorAtual = watch("valor");
  const transporteAtual = watch("transporte_valor");
  const servicoAtual = watch("servico");
  const manejoEspecial = watch("manejo_especial");
  const pacoteDoRegistro = watch("pacote");
  const listaServicos = servicos.data?.results ?? [];

  // O vínculo com o pacote, na EDIÇÃO, é o que está gravado no registro — nunca o
  // recalculado a partir do pacote-ativo de agora. Recalcular era o bug: abrir o 4º
  // banho (saldo 0) só para corrigir o horário mandava `pacote: null`, o consumo virava
  // avulso e o dinheiro já pago na venda era faturado de novo (invariante 1).
  const pacoteVinculado = editando ? pacoteDoRegistro : temSaldo && !cobrarAvulso ? pacote!.id : null;
  const usaPacote = pacoteVinculado != null;

  // O que há a cobrar. O serviço só é devido no avulso (no pacote foi pago na venda);
  // a corrida é devida sempre, porque é cobrada por viagem e não sai da cota.
  const valorDevido =
    (usaPacote ? 0 : paraNumero(valorAtual)) + (transporte ? paraNumero(transporteAtual) : 0);

  // Avulso sempre pede pagamento; pacote só quando houve corrida a cobrar.
  const mostrarPagamentos = !usaPacote || valorDevido > 0;

  /** Sugere o preço da faixa de peso do pet (+40% se manejo especial).
   *
   *  Chamado só a partir de ação da usuária, e nunca de um `useEffect`. Como efeito, ele
   *  disparava também quando o `reset()` da edição preenchia o form — e gravava o preço
   *  do catálogo por cima do valor realmente cobrado, quebrando a invariante 7 (a
   *  Patricia abria o atendimento para corrigir o horário e saía trocando R$ 150 por
   *  R$ 65). É a mesma armadilha que o PacoteForm evita com um ref de montagem; aqui,
   *  não ter efeito nenhum resolve por construção. */
  function sugerirValor(servicoId: string | number, porte: Porte, manejo: boolean) {
    const s = listaServicos.find((x) => x.id === Number(servicoId));
    if (!s) return;
    const base = Number(precoParaPorte(s, porte));
    setValue("valor", (manejo ? base * ACRESCIMO_MANEJO : base).toFixed(2));
  }

  function escolherPet(item: { id: number; rotulo: string } | null) {
    const pet = buscaPets.data?.results.find((p) => p.id === item?.id);
    const porte = pet?.porte ?? "";
    // Pet cadastrado como agressivo entra com o manejo já marcado. É default, não trava:
    // ela desmarca se o pet veio manso e o preço acompanha pelo onChange do checkbox.
    const agressivo = pet?.agressivo ?? false;
    setPetSelecionado(
      item
        ? {
            ...item,
            porte,
            agressivo,
            otite: pet?.otite ?? false,
            problema_pele: pet?.problema_pele ?? false,
          }
        : null,
    );
    setCobrarAvulso(false); // novo pet volta ao default seguro
    setValue("pet", item?.id ?? 0);
    // Os efeitos financeiros só valem na criação. Na edição, `valor` é o snapshot do que
    // ela cobrou naquele dia (invariante 7) — reencostar no campo Pet para corrigir um
    // vínculo errado não pode reescrever preço nem remarcar o manejo. O `sugerirValor`
    // já vivia aqui sem gate e já apagava o valor histórico nesse caminho; o gate fecha
    // o buraco antigo junto com o novo.
    if (!editando) {
      setValue("manejo_especial", agressivo);
      // `agressivo`, e NÃO o `manejoEspecial` do watch: o watch ainda carrega o valor
      // anterior neste tick. Passar o velho deixaria o checkbox marcado com o preço sem
      // os 40% — erro que não aparece na tela e sangra dinheiro todo dia.
      sugerirValor(servicoAtual, porte, agressivo);
    }
  }

  function enviar(dados: AtendimentoEntrada) {
    // Os valores saem com ponto: ela digita "65,00" e o DecimalField do DRF só aceita
    // "65.00". Converter no envio, e não recusar no campo.
    const payload: AtendimentoEntrada = {
      ...dados,
      pet: petSelecionado?.id ?? 0,
      pacote: pacoteVinculado,
      valor: normalizarDecimal(dados.valor),
      // Desmarcar "leva e traz" precisa zerar o valor: o campo some da tela mas o
      // estado do form guarda o que já foi digitado, e o backend fatura
      // `transporte_valor` sem olhar o booleano — uma corrida que não houve entraria
      // no faturamento.
      transporte_valor: dados.transporte ? normalizarDecimal(dados.transporte_valor) : "0.00",
      pagamentos: mostrarPagamentos
        ? dados.pagamentos.map((p) => ({ ...p, valor: normalizarDecimal(p.valor) }))
        : [],
    };
    if (editando) {
      atualizar.mutate(payload, { onSuccess: () => navigate("/atendimentos") });
    } else {
      criar.mutate(payload, { onSuccess: () => navigate("/atendimentos") });
    }
  }

  const itensPet =
    buscaPets.data?.results.map((p) => ({ id: p.id, rotulo: `${p.nome} · ${p.tutor_nome}` })) ?? [];

  // O 400 do backend (soma dos pagamentos ≠ devido, pacote sem saldo) era engolido: ela
  // clicava Salvar e não acontecia nada — sem navegação, sem mensagem, sem pista.
  const erro = criar.error ?? atualizar.error;

  // Enquanto a busca do pacote não volta, `pacote` é null e o banho sairia avulso. Como a
  // busca agora roda a cada troca de data, salvar logo depois de mexer na data mandava
  // `pacote: null` com o pagamento cheio (faturamento em dobro). Na edição o vínculo é o
  // do registro e não depende da busca.
  const aguardandoPacote = !editando && petSelecionado != null && !pacoteAtivo.isSuccess;
  const salvando = criar.isPending || atualizar.isPending;

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl text-escuro">
        {editando ? "Editar atendimento" : "Novo atendimento"}
      </h1>

      {/* Três grupos (quem, quando, quanto) sem mudar a ordem dos campos: eram dez
          controles numa coluna só, com o mesmo espaçamento, e nada separava o que é
          agenda do que é dinheiro. */}
      <form onSubmit={handleSubmit(enviar)} className="mt-6 flex flex-col gap-8" noValidate>
        <fieldset className={GRUPO}>
          <legend className={LEGENDA}>Cliente</legend>

          <Controller
            control={control}
            name="pet"
            rules={{ validate: () => petSelecionado != null || "Escolha um pet" }}
            render={() => (
              <Combobox
                label="Pet"
                itens={itensPet}
                valor={petSelecionado}
                carregando={buscaPets.isFetching}
                placeholder="Buscar por nome do pet ou tutor"
                aoDigitarBusca={setTextoPet}
                aoSelecionar={escolherPet}
                error={formState.errors.pet?.message}
              />
            )}
          />

          {!editando && petSelecionado && (
            <AlertasDoPet
              agressivo={petSelecionado.agressivo}
              otite={petSelecionado.otite}
              problemaPele={petSelecionado.problema_pele}
            />
          )}

          {/* A origem (e o "cobrar como avulso") só se escolhe na criação: na edição o
              vínculo é o do registro e trocá-lo depois reescreveria faturamento passado.
              Espera a busca terminar: durante o fetch `pacote` é null e a caixa piscaria
              "sem pacote" antes de achar o pacote. */}
          {!editando && petSelecionado && pacoteAtivo.isSuccess && (
            <OrigemAtendimento
              pacote={pacote}
              usaPacote={usaPacote}
              nomePet={pacote?.pet_nome ?? petSelecionado.rotulo.split(" · ")[0]}
              data={dataConsulta}
              aoCobrarAvulso={() => setCobrarAvulso(true)}
              aoUsarPacote={() => setCobrarAvulso(false)}
            />
          )}
          {!editando && petSelecionado && pacoteAtivo.isError && (
            <p role="alert" className="text-sm text-erro">
              Não consegui verificar se {petSelecionado.rotulo.split(" · ")[0]} tem pacote.{" "}
              <button
                type="button"
                onClick={() => pacoteAtivo.refetch()}
                className="font-medium underline underline-offset-2"
              >
                Tentar de novo
              </button>
            </p>
          )}
          {editando && pacoteVinculado != null && (
            <p className="text-sm text-neutro">
              Este banho saiu do pacote e já foi pago na venda. Isso não muda ao editar.
            </p>
          )}

        </fieldset>

        <fieldset className={`${GRUPO} ${DIVISOR}`}>
          <legend className={LEGENDA}>Serviço e horário</legend>

          <Select
            label="Serviço"
            error={formState.errors.servico?.message}
            {...register("servico", {
              // "Selecione..." tem valor 0 e passava direto para o backend, que devolvia
              // um erro genérico longe do campo.
              validate: (v) => Number(v) > 0 || "Escolha o serviço",
              // Só sugere na criação. Na edição, `valor` é o snapshot do que ela cobrou
              // (invariante 7); trocar o serviço não pode reescrevê-lo — ela ajusta à mão.
              onChange: (e) => {
                if (!editando) sugerirValor(e.target.value, petSelecionado?.porte ?? "", manejoEspecial);
              },
            })}
          >
            <option value="0">Selecione...</option>
            {listaServicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Data" type="date" {...register("data")} />
            {/* Obrigatório no model. Sem a checagem aqui, ela via "Este campo é
                obrigatório." perto do Salvar sem nenhum campo marcado. */}
            <Input
              label="Horário"
              type="time"
              error={formState.errors.horario?.message}
              {...register("horario", { required: "Informe o horário" })}
            />
          </div>

          <Checkbox
            label="Manejo especial (pet agressivo ou contenção) · +40%"
            {...register("manejo_especial", {
              onChange: (e) => {
                if (!editando) sugerirValor(servicoAtual, petSelecionado?.porte ?? "", e.target.checked);
              },
            })}
          />

        </fieldset>

        <fieldset className={`${GRUPO} ${DIVISOR}`}>
          <legend className={LEGENDA}>Cobrança</legend>

          {/* "Valor do serviço", e não "Valor": a tela tem também o valor do transporte e
              o valor de cada pagamento. Três campos chamados "Valor" confundem a Patricia
              e o leitor de tela igualmente. */}
          <Input label="Valor do serviço" inputMode="decimal" {...register("valor")} />
          {/* No consumo, o valor é só referência (invariante 2: nunca zerado). Sem esta
              linha, "R$ 65,00" no campo parecia dinheiro sendo cobrado de novo. */}
          {usaPacote && (
            <p className="-mt-2 text-xs text-escuro-suave">
              Preço de referência. Não é cobrado agora: o banho já foi pago na venda do pacote.
            </p>
          )}

          <Checkbox label="Leva e traz (transporte)" {...register("transporte")} />
          {transporte && (
            <Input label="Valor do transporte" inputMode="decimal" {...register("transporte_valor")} />
          )}

          {/* "Situação" e não "Status", e cada opção diz o que faz com o crédito: é o
              núcleo do dinheiro (invariante 4) e antes a tela não dizia. Os `value` são
              os da API. */}
          <Select label="Situação" {...register("status")}>
            <option value="Pendente">Pendente (agendado, segura o crédito do pacote)</option>
            <option value="Liberado">Liberado (banho feito)</option>
            <option value="Cancelado">Cancelado (não vai acontecer, devolve o crédito)</option>
          </Select>

          {/* No pacote, o banho já foi pago na venda — mas a corrida não, e ela é
              cobrada por viagem. Esconder os pagamentos sempre que houver pacote era
              o buraco por onde o dinheiro do transporte sumia sem lançamento.
              No avulso o bloco aparece sempre, mesmo antes de digitar o valor: gatear
              por `valorDevido > 0` esconderia os pagamentos do formulário em branco. */}
          {mostrarPagamentos && (
            <PagamentosField
              control={control}
              register={register}
              watch={watch}
              valorDevido={valorDevido}
              soTransporte={usaPacote}
            />
          )}
        </fieldset>

        {/* O erro fica junto do botão: no topo, no celular, ele aparecia fora da tela e
            parecia que o Salvar não tinha feito nada. */}
        {erro && (
          <p role="alert" className="rounded-lg bg-erro/10 px-4 py-3 text-sm text-erro">
            {mensagemDeErro(erro)}
          </p>
        )}

        <div className="flex justify-end gap-2">
          {/* "Voltar" e não "Cancelar": na edição de um atendimento, "Cancelar" soava
              como cancelar o banho, que é outra ação da tabela. E volta para onde ela
              estava (Agenda ou lista); sem histórico no app (link direto), cai na lista. */}
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              window.history.state?.idx > 0 ? navigate(-1) : navigate("/atendimentos")
            }
          >
            Voltar
          </Button>
          {/* O rótulo diz por que o botão está parado; desabilitado e mudo, ela tocava
              de novo achando que não tinha pegado. */}
          <Button type="submit" disabled={salvando || aguardandoPacote}>
            {salvando ? "Salvando..." : aguardandoPacote ? "Verificando pacote..." : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
