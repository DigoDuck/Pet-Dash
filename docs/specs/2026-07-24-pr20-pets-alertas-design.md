# PR 20 · `feat/pets-alertas` — Design doc

> Data: 2026-07-24. Aprovado por Diogo em sessão de brainstorming.
> Origem: pedido da Patricia (usuária), pós-MVP. Não estava no plano de projeto original.
> Fontes: `docs/specs/2026-07-02-petdash-plan-design.md`, invariante 7 do `CLAUDE.md`, código dos PRs 10 e 12.

## Contexto

A tela `/clientes` lista só tutores, com busca em `nome` e `telefone` do tutor. Os pets aparecem apenas
dentro da ficha do tutor (`TutorDetalhe`). Consequência prática: buscar "Thor" em `/clientes` não devolve
nada, porque o sistema só entende nome de dono — e a Patricia pensa em nome de pet ("o Thor vem hoje").

Ela pediu três coisas na mesma conversa:

1. Uma forma de ver todos os pets cadastrados, com um switch alternando a lista entre Tutores e Pets.
2. Marcar no cadastro do pet que ele é agressivo, e que isso pré-marque o `manejo_especial` na criação do
   atendimento, com aviso visível.
3. Marcar condições de saúde no cadastro do pet: otite e problema de pele.

O backend já suporta a listagem de pets sem nenhuma mudança: `PetViewSet` é paginado, filtra `ativo=True`,
faz `search` em `nome` e `tutor__nome` e já devolve `tutor_nome`, `porte` e `vip`
(`backend/core/views.py:44-51`). O que falta é frontend e três campos novos.

## Decisões

1. **Condições de saúde como boolean, não texto livre.** `otite` e `problema_pele` viram `BooleanField`,
   não um campo `observacoes`. Boolean vira badge na lista e alerta no atendimento; texto livre não —
   ela teria que ler cada ficha para saber. Custo aceito: cada condição futura pede uma migration.
   **Teto conhecido:** três checkboxes ainda cabem no formulário e o `AlertasDoPet` nasce como lista
   (flag novo = uma linha). A partir do quinto, o formulário entope e a conversa passa a ser texto livre
   ou tabela de condições. Revisitar lá, não antes.

2. **Só `agressivo` toca em dinheiro.** `manejo_especial` multiplica a sugestão de preço por 1.4
   (`AtendimentoForm.tsx:118-123`), então pré-marcá-lo mexe no valor sugerido. `otite` e `problema_pele`
   são aviso puro: não marcam nada, não alteram sugestão. Manter uma única entrada no caminho do valor é
   o que faz o teste de regressão da invariante 7 continuar significando alguma coisa.

3. **A pré-marcação acontece em `escolherPet`, nunca em `useEffect`, e só na criação.** O arquivo já
   documenta
   (`AtendimentoForm.tsx:110-117`) por que `sugerirValor` não pode viver num efeito: o `reset()` da edição
   disparava e gravava preço de catálogo por cima do valor cobrado, quebrando a invariante 7. Pré-marcar
   por efeito recria o bug idêntico — a Patricia abriria um atendimento antigo de pet agressivo só para
   corrigir o horário e sairia com `manejo_especial` marcado e o valor reescrito.

   O mesmo raciocínio fecha uma segunda porta, encontrada na revisão da Task 3: o `Combobox` de Pet não
   é desabilitado na edição, então `escolherPet` é alcançável lá. Os efeitos financeiros
   (`setValue("manejo_especial", ...)` e `sugerirValor`) ficam atrás de `if (!editando)`. O
   `sugerirValor` já vivia nessa função sem gate desde antes deste PR e já apagava o valor histórico
   quando ela reencostava no campo Pet durante uma edição; o gate conserta o bug antigo junto. O
   `setPetSelecionado` fica fora do gate — corrigir um vínculo errado continua possível, só o preço não
   acompanha.

   A mesma revisão mostrou que `sugerirValor` tinha outros dois call sites sem gate: o `onChange` do
   `<Select>` de serviço e o do checkbox de manejo. Na edição, trocar o serviço ou marcar o manejo
   reescrevia `valor` a partir do catálogo (e da faixa errada, porque o porte é `""` na edição), por cima
   do snapshot. Os três call sites de `sugerirValor` passam a ser gateados por `!editando`. Na edição o
   `valor` é o que ela cobrou: se quiser mudá-lo, edita o campo à mão. Decisão do Diogo em 24/07/2026,
   corrigida dentro deste PR por ser o mesmo mecanismo e o contexto estar quente.

4. **Os flags chegam ao atendimento pelo `petSelecionado`, sem request novo.** O state local já guarda
   `{id, rotulo, porte}` capturado no `escolherPet` (`AtendimentoForm.tsx:125`), e os flags já vêm no
   payload de `/pets/?search=`. Descartados: `usePet(id)` (request extra para dado que já está na tela) e
   expor `pet_agressivo`/`pet_otite` no `AtendimentoSerializer` (polui o serializer de atendimento com
   dados do pet e não ajuda na criação).

   **Buraco aceito:** na edição o banner não aparece, porque `petSelecionado` é remontado de
   `existente.data`, que não traz os flags. O aviso serve para decidir na hora de criar; é o mesmo
   comportamento do `PacoteAtivoBanner`, que também só existe na criação (`AtendimentoForm.tsx:193`).

5. **`problema_pele`, não `dermatite`.** Ela falou genérico. Nome de diagnóstico específico obrigaria a
   Patricia a decidir se o caso "conta" como aquilo — e ela não é veterinária.

6. **A aba fica em state local, fora da URL.** Mesma escolha que busca e paginação já fazem na página
   hoje. Custo conhecido: voltar da ficha de um pet cai na aba Tutores. Colocar na URL é uma linha se
   incomodar no uso.

7. **O botão do cabeçalho continua "Novo tutor" nas duas abas.** Pet sempre precisa de um dono; criar pet
   a partir da aba Pets exigiria um combobox de tutor no modal, que não existe. A criação de pet continua
   na ficha do tutor, onde o dono já está definido.

## Backend

Migration com três booleans em `Pet` (`backend/core/models.py`):

```python
agressivo = models.BooleanField(default=False)
otite = models.BooleanField(default=False)
problema_pele = models.BooleanField(default=False)
```

`default=False` cobre a base existente sem `null`, e nenhum dos três participa de query financeira.

`PetSerializer.fields` ganha os três como graváveis (`backend/core/serializers.py:25-28`).
`filterset_fields` **não** muda: filtrar pets por condição ninguém pediu, e um filtro não declarado é
ignorado em silêncio pelo django-filter — declarar por precaução não custa nada mas também não serve a
ninguém hoje.

Nenhum toque em faturamento. `manejo_especial` continua sem recalcular `valor` no backend; a invariante 7
segue intacta.

### Teste

`backend/tests/test_api_cadastros.py`: POST e PATCH em `/pets/` gravam e devolvem os três flags.

## Frontend — aba Pets

`Clientes.tsx` ganha `const [aba, setAba] = useState<"tutores" | "pets">("tutores")` e um par de botões
toggle no topo da lista. Trocar de aba reseta `pagina` para 1 e limpa os dois estados de busca (`texto`
e `busca`, o par com debounce que já existe na página): o mesmo texto significa
coisas diferentes nos dois endpoints (`nome`+`telefone` do tutor contra `nome` do pet + `nome` do tutor).
O label do input acompanha: "Buscar por nome ou telefone" → "Buscar por nome do pet ou tutor".

Hook novo em `hooks/usePets.ts`, espelhando `useTutores`:

```ts
export function usePets(busca: string, pagina: number)  // GET /pets/?search=&page=
```

O `useBuscaPets` existente não serve: tem `enabled: termo.length > 0`, então não lista nada com a busca
vazia. Os dois convivem — o combobox do atendimento quer busca sob demanda, a listagem quer a página cheia.

Tabela de pets: **Pet · Tutor · Porte · Alertas**, linha inteira linkando `/pets/:id`, mesmo tratamento
visual da tabela de tutores. Coluna Alertas = badges `VIP` (dado já vem do serializer), `Agressivo`,
`Otite`, `Pele`.

A seção "Destaques do mês" continua embaixo, sem mudança: vale para as duas abas.

## Frontend — cadastro do pet

`components/clientes/PetForm.tsx` ganha três `Checkbox`:

- "Pet agressivo / precisa de contenção"
- "Tem otite"
- "Tem problema de pele"

Schema zod ganha `agressivo: z.boolean()`, `otite: z.boolean()`, `problema_pele: z.boolean()`;
`PetEntrada` (`hooks/usePets.ts`) e `Pet` (`lib/types.ts`) idem. `defaultValues` do form inclui os três
como `false` — sem isso o React reclama de input não-controlado virando controlado ao editar um pet
antigo.

`PetCard` e `PetDetalhe` exibem as badges ao lado da VIP que já existe.

## Frontend — propagação para o atendimento

`escolherPet` (`AtendimentoForm.tsx:125`) passa a fazer três coisas a mais:

```ts
const marcar = pet?.agressivo ?? false;
setPetSelecionado(
  item
    ? { ...item, porte, agressivo: marcar, otite: pet?.otite ?? false,
        problema_pele: pet?.problema_pele ?? false }
    : null,
);
setValue("manejo_especial", marcar);
sugerirValor(servicoAtual, porte, marcar);   // `marcar`, NÃO o `manejoEspecial` do watch
```

O último argumento é a armadilha silenciosa: a função hoje recebe `manejoEspecial` lido do `watch`, que
ainda carrega o valor anterior no mesmo tick do `setValue`. Passar a variável velha faria o checkbox
aparecer marcado e o preço sair sem os 40% — erro que não quebra nada visualmente e sangra dinheiro.

Componente novo `components/atendimentos/AlertasDoPet.tsx`, irmão do `PacoteAtivoBanner`, renderizado só
quando `!editando && petSelecionado` e houver ao menos um flag:

- agressivo → "Este pet foi cadastrado como agressivo — manejo especial já marcado (+40%)."
- otite → "Este pet tem otite — cuidado com o ouvido no banho."
- problema de pele → "Este pet tem problema de pele — atenção ao produto do banho."

Lista de mensagens filtrada pelos flags, não três blocos condicionais: flag futuro é uma linha.

O checkbox `manejo_especial` continua editável. O flag do pet é *default*, não trava — pet agressivo que
veio manso hoje ela desmarca, e o preço sugerido acompanha pelo `onChange` que já existe
(`AtendimentoForm.tsx:227-230`).

## Testes (Vitest + RTL + MSW)

1. `Clientes` — clicar em "Pets" troca a tabela e requisita `/pets/`; voltar para "Tutores" requisita
   `/tutores/`.
2. `PetForm` — marcar os três checkboxes envia `agressivo: true, otite: true, problema_pele: true`.
3. `AtendimentoForm` — selecionar pet agressivo pré-marca `manejo_especial`, exibe o aviso, **e a sugestão
   de preço já sai com os 40%**. É o teste que pega o bug do `watch` velho.
4. `AtendimentoForm` — abrir atendimento existente com `manejo_especial: false` cujo pet é agressivo
   **não** marca o checkbox nem altera `valor`. É o teste que pega a regressão da invariante 7.
5. `AtendimentoForm` — pet com otite e problema de pele exibe os avisos e **não** marca `manejo_especial`
   nem altera a sugestão de preço.

Os testes 3, 4 e 5 são o núcleo; 1 e 2 são cobertura de rotina.

## Fora de escopo

Filtro por condição na listagem · aba na URL · criar pet a partir da aba Pets · histórico de quando a
condição foi marcada · ligar `problema_pele` à regra dos +R$ 25 do banho medicinal (a regra da Patricia é
sobre parasita, não sobre pele — inventar essa ponte é decisão de negócio dela, a perguntar) · campo
`observacoes` de texto livre · mostrar os alertas na edição do atendimento.
