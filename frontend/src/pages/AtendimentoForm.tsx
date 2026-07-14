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

  const buscaPets = useBuscaPets(termoPet);
  const pacoteAtivo = usePacoteAtivo(petSelecionado?.id ?? null);
  const servicos = useServicos("", false);
  const criar = useCriarAtendimento();
  const existente = useAtendimento(editando ? Number(id) : 0);
  const atualizar = useAtualizarAtendimento(editando ? Number(id) : 0);

  const { register, handleSubmit, control, watch, setValue, reset, formState } =
    useForm<AtendimentoEntrada>({ defaultValues: VAZIO });

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
  const usaPacote = temSaldo && !cobrarAvulso;
  const transporte = watch("transporte");
  const valorAtual = watch("valor");
  const transporteAtual = watch("transporte_valor");
  const servicoAtual = watch("servico");
  const manejoEspecial = watch("manejo_especial");
  const listaServicos = servicos.data?.results ?? [];

  // O que há a cobrar. O serviço só é devido no avulso (no pacote foi pago na venda);
  // a corrida é devida sempre, porque é cobrada por viagem e não sai da cota.
  const valorDevido =
    (usaPacote ? 0 : Number(valorAtual || 0)) +
    (transporte ? Number(transporteAtual || 0) : 0);

  // Avulso sempre pede pagamento; pacote só quando houve corrida a cobrar.
  const mostrarPagamentos = !usaPacote || valorDevido > 0;

  // Sugere o preço ao trocar o serviço, o pet ou o manejo: os três mudam o valor.
  // A Patricia cobra por faixa de peso (65 no pequeno, 120 no médio, 150 no grande),
  // e +40% quando o pet exige contenção especial. É sugestão, sempre editável —
  // `Atendimento.valor` é o snapshot do que ela de fato cobrou (invariante 7).
  useEffect(() => {
    const s = listaServicos.find((x) => x.id === Number(servicoAtual));
    if (!s) return;
    const base = Number(precoParaPorte(s, petSelecionado?.porte ?? ""));
    const sugerido = manejoEspecial ? base * ACRESCIMO_MANEJO : base;
    setValue("valor", sugerido.toFixed(2));
  }, [servicoAtual, petSelecionado?.porte, manejoEspecial]); // eslint-disable-line react-hooks/exhaustive-deps

  function escolherPet(item: { id: number; rotulo: string } | null) {
    const pet = buscaPets.data?.results.find((p) => p.id === item?.id);
    setPetSelecionado(item ? { ...item, porte: pet?.porte ?? "" } : null);
    setCobrarAvulso(false); // novo pet volta ao default seguro
    setValue("pet", item?.id ?? 0);
  }

  function enviar(dados: AtendimentoEntrada) {
    const payload: AtendimentoEntrada = {
      ...dados,
      pet: petSelecionado?.id ?? 0,
      pacote: usaPacote ? pacote!.id : null,
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

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl text-escuro">
        {editando ? "Editar atendimento" : "Novo atendimento"}
      </h1>

      <form onSubmit={handleSubmit(enviar)} className="mt-6 flex flex-col gap-4" noValidate>
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

        {petSelecionado && usaPacote && pacote && (
          <PacoteAtivoBanner pacote={pacote} aoCobrarAvulso={() => setCobrarAvulso(true)} />
        )}
        {petSelecionado && pacote != null && pacote.saldo === 0 && (
          <p className="text-sm text-erro">Pacote sem saldo neste mês; cobrando como avulso.</p>
        )}

        <Select label="Serviço" {...register("servico")}>
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
          {...register("manejo_especial")}
        />

        {/* Sem value= explícito: o register controla o input via ref. O setValue do
            effect atualiza o valor exibido quando muda serviço, pet ou manejo. */}
        <Input label="Valor" inputMode="decimal" {...register("valor")} />

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
