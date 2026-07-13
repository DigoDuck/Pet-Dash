import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useBuscaPets } from "../../hooks/usePets";
import { useServicosPacote } from "../../hooks/useServicos";
import {
  hojeISO,
  inicioDaCompetencia,
  mesCorrente,
  mesDaCompetencia,
  ultimoDiaDoMes,
} from "../../lib/competencia";
import type { Pacote, PacoteEntrada } from "../../lib/types";
import { Button } from "../ui/Button";
import { Combobox } from "../ui/Combobox";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const schema = z.object({
  pet: z.number().min(1, "Escolha um pet"),
  servico: z.string().refine((v) => Number(v) > 0, "Escolha o serviço"),
  mes: z.string().min(1, "Informe a competência"),
  qtd_total: z
    .string()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, "Mínimo de 1 crédito"),
  valor_pago: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (ex.: 220.00)"),
  data_compra: z.string().min(1, "Informe a data da compra"),
  validade: z.string().min(1, "Informe a validade"),
});

type FormData = z.infer<typeof schema>;

interface PacoteFormProps {
  /** Presente => edição: pet e competência ficam travados (são a chave única). */
  inicial?: Pacote;
  aoSalvar: (dados: PacoteEntrada) => void;
  enviando: boolean;
  erro?: string;
  aoCancelar: () => void;
}

export function PacoteForm({ inicial, aoSalvar, enviando, erro, aoCancelar }: PacoteFormProps) {
  const editando = inicial != null;
  const [textoPet, setTextoPet] = useState("");
  const [termoPet, setTermoPet] = useState("");
  const [petSelecionado, setPetSelecionado] = useState<{ id: number; rotulo: string } | null>(
    inicial ? { id: inicial.pet, rotulo: `${inicial.pet_nome} · ${inicial.tutor_nome}` } : null,
  );

  // Debounce da busca de pet (300ms), como no AtendimentoForm: sem isto cada
  // tecla dispara um GET /pets/?search=.
  useEffect(() => {
    const t = setTimeout(() => setTermoPet(textoPet), 300);
    return () => clearTimeout(t);
  }, [textoPet]);

  const buscaPets = useBuscaPets(termoPet);
  const servicos = useServicosPacote();
  const listaServicos = servicos.data?.results ?? [];

  const mesInicial = inicial ? mesDaCompetencia(inicial.competencia) : mesCorrente();

  const { control, register, handleSubmit, setValue, watch, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      pet: inicial?.pet ?? 0,
      servico: inicial ? String(inicial.servico) : "0",
      mes: mesInicial,
      qtd_total: String(inicial?.qtd_total ?? 4),
      valor_pago: inicial?.valor_pago ?? "",
      data_compra: inicial?.data_compra ?? hojeISO(),
      validade: inicial?.validade ?? ultimoDiaDoMes(mesInicial),
    },
  });

  const servicoAtual = watch("servico");
  const mesAtual = watch("mes");

  // Os dois effects abaixo pulam o disparo de montagem. Na edição, rodar no
  // mount sobrescreveria o valor realmente cobrado com o preço do catálogo
  // (quebra a invariante 7) e a validade estendida à mão (invariante 5).
  const servicoMontado = useRef(false);
  useEffect(() => {
    if (!servicoMontado.current) {
      servicoMontado.current = true;
      return;
    }
    const s = listaServicos.find((x) => x.id === Number(servicoAtual));
    if (!s) return;
    setValue("valor_pago", s.preco_padrao);
    setValue("qtd_total", String(s.creditos ?? 4));
  }, [servicoAtual]); // eslint-disable-line react-hooks/exhaustive-deps

  const mesMontado = useRef(false);
  useEffect(() => {
    if (!mesMontado.current) {
      mesMontado.current = true;
      return;
    }
    if (mesAtual) setValue("validade", ultimoDiaDoMes(mesAtual));
  }, [mesAtual]); // eslint-disable-line react-hooks/exhaustive-deps

  function escolherPet(item: { id: number; rotulo: string } | null) {
    setPetSelecionado(item);
    setValue("pet", item?.id ?? 0, { shouldValidate: formState.isSubmitted });
  }

  function enviar(dados: FormData) {
    aoSalvar({
      pet: dados.pet,
      servico: Number(dados.servico),
      competencia: inicioDaCompetencia(dados.mes),
      qtd_total: Number(dados.qtd_total),
      valor_pago: dados.valor_pago,
      data_compra: dados.data_compra,
      validade: dados.validade,
    });
  }

  const itensPet =
    buscaPets.data?.results.map((p) => ({ id: p.id, rotulo: `${p.nome} · ${p.tutor_nome}` })) ?? [];

  return (
    <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4" noValidate>
      {erro && (
        <p role="alert" className="rounded-lg bg-erro/10 px-3 py-2 text-sm text-erro">
          {erro}
        </p>
      )}

      {editando ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-escuro">Pet</span>
          <p className="text-sm text-neutro">
            {inicial.pet_nome} · {inicial.tutor_nome}
          </p>
        </div>
      ) : (
        <Controller
          control={control}
          name="pet"
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
      )}

      <Select label="Serviço" error={formState.errors.servico?.message} {...register("servico")}>
        <option value="0">Selecione...</option>
        {listaServicos.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-4">
        {/* Competência trava na edição: junto com o pet, é a chave única do
            pacote — mudá-la seria outra venda disfarçada de edição. */}
        <Input
          label="Competência"
          type="month"
          disabled={editando}
          error={formState.errors.mes?.message}
          {...register("mes")}
        />
        <Input
          label="Validade"
          type="date"
          error={formState.errors.validade?.message}
          {...register("validade")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Valor pago"
          inputMode="decimal"
          placeholder="220.00"
          error={formState.errors.valor_pago?.message}
          {...register("valor_pago")}
        />
        <Input
          label="Créditos"
          type="number"
          min={1}
          error={formState.errors.qtd_total?.message}
          {...register("qtd_total")}
        />
      </div>

      <Input
        label="Data da compra"
        type="date"
        error={formState.errors.data_compra?.message}
        {...register("data_compra")}
      />

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
