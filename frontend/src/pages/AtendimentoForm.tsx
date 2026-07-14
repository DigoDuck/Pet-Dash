import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { PacoteAtivoBanner } from "../components/atendimentos/PacoteAtivoBanner";
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
import { inicioDaCompetencia, mesDaCompetencia } from "../lib/competencia";
import { ACRESCIMO_MANEJO, precoParaPorte, type AtendimentoEntrada, type Porte } from "../lib/types";

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

  // O pacote é procurado na competência do ATENDIMENTO, não na de hoje. A Patricia
  // lança com atraso (vem de planilha): em 1º de julho, o banho de 30 de junho tem que
  // consultar o pacote de junho. Consultar o de julho fazia o banho nascer avulso — e o
  // dinheiro de junho ser faturado duas vezes.
  const dataAtual = watch("data");
  const competencia = dataAtual ? inicioDaCompetencia(mesDaCompetencia(dataAtual)) : "";

  const buscaPets = useBuscaPets(termoPet);
  const pacoteAtivo = usePacoteAtivo(petSelecionado?.id ?? null, competencia);
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
      setPetSelecionado({ id: existente.data.pet, rotulo: existente.data.pet_nome, porte: "" });
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
    (usaPacote ? 0 : Number(valorAtual || 0)) +
    (transporte ? Number(transporteAtual || 0) : 0);

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
    setPetSelecionado(item ? { ...item, porte } : null);
    setCobrarAvulso(false); // novo pet volta ao default seguro
    setValue("pet", item?.id ?? 0);
    sugerirValor(servicoAtual, porte, manejoEspecial);
  }

  function enviar(dados: AtendimentoEntrada) {
    const payload: AtendimentoEntrada = {
      ...dados,
      pet: petSelecionado?.id ?? 0,
      pacote: pacoteVinculado,
      // Desmarcar "leva e traz" precisa zerar o valor: o campo some da tela mas o
      // estado do form guarda o que já foi digitado, e o backend fatura
      // `transporte_valor` sem olhar o booleano — uma corrida que não houve entraria
      // no faturamento.
      transporte_valor: dados.transporte ? dados.transporte_valor : "0.00",
      pagamentos: mostrarPagamentos ? dados.pagamentos : [],
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

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl text-escuro">
        {editando ? "Editar atendimento" : "Novo atendimento"}
      </h1>

      <form onSubmit={handleSubmit(enviar)} className="mt-6 flex flex-col gap-4" noValidate>
        {erro && (
          <p role="alert" className="rounded-lg bg-erro/10 px-4 py-3 text-sm text-erro">
            {mensagemDeErro(erro)}
          </p>
        )}

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

        {/* O banner (e o "cobrar como avulso") só existe na criação: na edição o vínculo
            é o do registro e trocá-lo depois reescreveria faturamento passado. */}
        {!editando && petSelecionado && usaPacote && pacote && (
          <PacoteAtivoBanner pacote={pacote} aoCobrarAvulso={() => setCobrarAvulso(true)} />
        )}
        {!editando && petSelecionado && pacote != null && pacote.saldo === 0 && (
          <p className="text-sm text-erro">Pacote sem saldo neste mês; cobrando como avulso.</p>
        )}
        {editando && pacoteVinculado != null && (
          <p className="text-sm text-neutro">
            Consumo de pacote. O banho já foi pago na venda; o vínculo não muda ao editar.
          </p>
        )}

        <Select
          label="Serviço"
          {...register("servico", {
            onChange: (e) =>
              sugerirValor(e.target.value, petSelecionado?.porte ?? "", manejoEspecial),
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
          <Input label="Horário" type="time" {...register("horario")} />
        </div>

        <Checkbox
          label="Manejo especial (pet agressivo ou contenção) · +40%"
          {...register("manejo_especial", {
            onChange: (e) =>
              sugerirValor(servicoAtual, petSelecionado?.porte ?? "", e.target.checked),
          })}
        />

        {/* "Valor do serviço", e não "Valor": a tela tem também o valor do transporte e
            o valor de cada pagamento. Três campos chamados "Valor" confundem a Patricia
            e o leitor de tela igualmente. */}
        <Input label="Valor do serviço" inputMode="decimal" {...register("valor")} />

        <Checkbox label="Leva e traz (transporte)" {...register("transporte")} />
        {transporte && (
          <Input label="Valor do transporte" inputMode="decimal" {...register("transporte_valor")} />
        )}

        <Select label="Status" {...register("status")}>
          <option value="Pendente">Pendente</option>
          <option value="Liberado">Liberado</option>
          <option value="Cancelado">Cancelado</option>
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
          />
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate("/atendimentos")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={criar.isPending || atualizar.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}
