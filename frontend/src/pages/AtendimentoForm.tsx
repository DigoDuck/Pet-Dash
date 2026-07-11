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
import type { AtendimentoEntrada } from "../lib/types";

const VAZIO: AtendimentoEntrada = {
  pet: 0, servico: 0, pacote: null, data: "", horario: "", valor: "",
  transporte: false, transporte_valor: "0.00", status: "Pendente", pagamentos: [],
};

export function AtendimentoForm() {
  const { id } = useParams();
  const editando = id != null;
  const navigate = useNavigate();

  const [textoPet, setTextoPet] = useState("");
  const [termoPet, setTermoPet] = useState("");
  const [petSelecionado, setPetSelecionado] = useState<{ id: number; rotulo: string } | null>(null);
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
      setPetSelecionado({ id: existente.data.pet, rotulo: existente.data.pet_nome });
    }
  }, [existente.data, reset]);

  const pacote = pacoteAtivo.data ?? null;
  const temSaldo = pacote != null && pacote.saldo > 0;
  const usaPacote = temSaldo && !cobrarAvulso;
  const transporte = watch("transporte");
  const valorAtual = watch("valor");
  const servicoAtual = watch("servico");
  const listaServicos = servicos.data?.results ?? [];

  // Ao escolher o serviço, sugere o preço de referência (editável).
  useEffect(() => {
    const s = listaServicos.find((x) => x.id === Number(servicoAtual));
    if (s) setValue("valor", s.preco_padrao);
  }, [servicoAtual]); // eslint-disable-line react-hooks/exhaustive-deps

  function escolherPet(item: { id: number; rotulo: string } | null) {
    setPetSelecionado(item);
    setCobrarAvulso(false); // novo pet volta ao default seguro
    setValue("pet", item?.id ?? 0);
  }

  function enviar(dados: AtendimentoEntrada) {
    const payload: AtendimentoEntrada = {
      ...dados,
      pet: petSelecionado?.id ?? 0,
      pacote: usaPacote ? pacote!.id : null,
      pagamentos: usaPacote ? [] : dados.pagamentos,
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

        {/* Sem value= explícito: o register controla o input via ref. O
            setValue no effect do serviço atualiza o valor exibido. */}
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

        {!usaPacote && (
          <PagamentosField
            control={control}
            register={register}
            watch={watch}
            valorAtendimento={valorAtual}
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
