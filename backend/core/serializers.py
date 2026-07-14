from decimal import Decimal

from rest_framework import serializers

from . import models, services


class TutorSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Tutor
        fields = ["id", "nome", "telefone", "email", "ativo", "created_at"]
        read_only_fields = ["ativo", "created_at"]


class PetSerializer(serializers.ModelSerializer):
    tutor_nome = serializers.CharField(source="tutor.nome", read_only=True)
    # SerializerMethodField (e não BooleanField/IntegerField) porque o objeto
    # devolvido pelo POST não passa pelo get_queryset() anotado do ViewSet.
    vip = serializers.SerializerMethodField()
    qtd_visitas = serializers.SerializerMethodField()
    total_gasto = serializers.SerializerMethodField()

    class Meta:
        model = models.Pet
        fields = [
            "id", "tutor", "tutor_nome", "nome", "raca", "porte", "ativo",
            "created_at", "vip", "qtd_visitas", "total_gasto",
        ]
        read_only_fields = ["ativo", "created_at"]

    def get_qtd_visitas(self, obj) -> int:
        return getattr(obj, "qtd_visitas", 0)

    def get_total_gasto(self, obj) -> str:
        total = getattr(obj, "total_gasto", None) or Decimal("0")
        return str(total.quantize(Decimal("0.01")))

    def get_vip(self, obj) -> bool:
        # Derivado, nunca armazenado (invariante 6). Vale tanto para o queryset
        # anotado pelo PetViewSet (janela de 365 dias) quanto para o do
        # dashboard (pets_vip, janela do período consultado).
        return services.eh_vip(
            self.get_qtd_visitas(obj), Decimal(self.get_total_gasto(obj))
        )


class ServicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Servico
        fields = [
            "id", "nome", "preco_padrao", "preco_m", "preco_g",
            "is_pacote", "creditos", "ativo",
        ]


class PagamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Pagamento
        fields = ["id", "metodo", "valor"]
        
        
class PacoteContratadoSerializer(serializers.ModelSerializer):
    saldo = serializers.SerializerMethodField()
    pet_nome = serializers.CharField(source="pet.nome", read_only=True)
    tutor_nome = serializers.CharField(source="pet.tutor.nome", read_only=True)
    servico_nome = serializers.CharField(source="servico.nome", read_only=True)

    class Meta:
        model = models.PacoteContratado
        fields = [
            "id", "pet", "pet_nome", "tutor_nome", "servico", "servico_nome",
            "competencia", "qtd_total", "valor_pago", "data_compra", "validade", "saldo",
        ]

    def get_saldo(self, obj):
        return obj.saldo()

    def validate(self, attrs):
        # Só valida o serviço quando ele vem no payload. No PATCH parcial (editar
        # a validade por um reagendamento), o serviço herdado do instance pode ter
        # virado avulso no catálogo DEPOIS da venda; revalidá-lo travaria a edição
        # de um pacote legítimo. O POST sempre manda o campo, então o caminho de
        # criação continua coberto.
        servico = attrs.get("servico")
        if servico is not None and not servico.is_pacote:
            raise serializers.ValidationError(
                {"servico": ["Este serviço não é um pacote. Marque 'é pacote?' no catálogo."]}
            )

        pet = attrs.get("pet", getattr(self.instance, "pet", None))
        competencia = attrs.get("competencia", getattr(self.instance, "competencia", None))
        if pet and competencia:
            competencia_normalizada = competencia.replace(day=1)
            qs = models.PacoteContratado.objects.filter(
                pet=pet, competencia=competencia_normalizada
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "Já existe um pacote para este pet nesta competência."
                )
        return attrs


class CustoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Custo
        fields = ["id", "tipo", "descricao", "valor", "categoria", "competencia"]


class RetiradaSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Retirada
        fields = ["id", "descricao", "valor", "data", "tipo"]


class TopTutorSerializer(serializers.ModelSerializer):
    gasto_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = models.Tutor
        fields = ["id", "nome", "gasto_total"]


class CategoriaCustoSerializer(serializers.Serializer):
    categoria = serializers.CharField()
    valor = serializers.DecimalField(max_digits=10, decimal_places=2)


class TransacaoSerializer(serializers.Serializer):
    """`valor` é sempre positivo; o sinal (+/−) é derivado do `tipo` na tela.

    Guardar o sinal aqui exigiria negar o Decimal e abrir espaço para alguém somar
    o feed e achar que tem um total — o que seria agregação financeira fora da query
    (invariante 9).
    """

    tipo = serializers.ChoiceField(choices=["atendimento", "pacote", "custo", "retirada"])
    descricao = serializers.CharField()
    valor = serializers.DecimalField(max_digits=10, decimal_places=2)
    data = serializers.DateField()


class PontoSerieSerializer(serializers.Serializer):
    """Um mês do gráfico. `competencia` é sempre o dia 1."""

    competencia = serializers.DateField()
    faturamento = serializers.DecimalField(max_digits=10, decimal_places=2)
    custos = serializers.DecimalField(max_digits=10, decimal_places=2)
    lucro = serializers.DecimalField(max_digits=10, decimal_places=2)


class DashboardSerializer(serializers.Serializer):
    # Todos os valores monetários saem como string ("315.00"), padrão DRF,
    # para o front não receber float e string misturados na mesma resposta.
    faturamento = serializers.DecimalField(max_digits=10, decimal_places=2)
    custos = serializers.DecimalField(max_digits=10, decimal_places=2)
    retiradas = serializers.DecimalField(max_digits=10, decimal_places=2)
    lucro = serializers.DecimalField(max_digits=10, decimal_places=2)
    ticket_medio = serializers.DecimalField(max_digits=10, decimal_places=2)
    margem = serializers.DecimalField(max_digits=6, decimal_places=4)
    # Parcela do faturamento que veio das corridas. É o número que concilia com a
    # planilha e responde "o triciclo se paga?".
    transporte = serializers.DecimalField(max_digits=10, decimal_places=2)
    # Visitas Liberadas (inclui consumo de pacote) — não confundir com o denominador
    # do ticket médio, que conta eventos de receita. Ver dashboard_periodo.
    qtd_atendimentos = serializers.IntegerField()
    pets_ativos = serializers.IntegerField()


class AtendimentoSerializer(serializers.ModelSerializer):
    pagamentos = PagamentoSerializer(many=True, required=False)
    servico_nome = serializers.CharField(source="servico.nome", read_only=True)
    pet_nome = serializers.CharField(source="pet.nome", read_only=True)
    tutor_nome = serializers.CharField(source="pet.tutor.nome", read_only=True)
    # Anotado por subquery no ViewSet. No POST o objeto não passa pelo get_queryset()
    # anotado, então cai em False — a tela de criação não mostra badge, e não precisa.
    pet_vip = serializers.SerializerMethodField()

    class Meta:
        model = models.Atendimento
        fields = [
            "id", "pet", "pet_nome", "tutor_nome", "pet_vip", "servico", "servico_nome",
            "pacote", "data", "horario", "valor", "transporte", "transporte_valor",
            "manejo_especial", "status", "pagamentos",
        ]

    def get_pet_vip(self, obj) -> bool:
        return services.eh_vip(
            getattr(obj, "pet_visitas", 0) or 0,
            getattr(obj, "pet_gasto", None) or Decimal("0"),
        )

    def create(self, validated_data):
        pagamentos = validated_data.pop("pagamentos", [])
        atendimento = models.Atendimento.objects.create(**validated_data)
        for pag in pagamentos:
            models.Pagamento.objects.create(atendimento=atendimento, **pag)
        return atendimento

    def update(self, instance, validated_data):
        pagamentos = validated_data.pop("pagamentos", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if pagamentos is not None:
            instance.pagamentos.all().delete()
            for pag in pagamentos:
                models.Pagamento.objects.create(atendimento=instance, **pag)
        return instance

    def validate(self, attrs):
        # No PATCH, os campos podem não vir; herdar do instance (update parcial).
        pacote = attrs.get("pacote", getattr(self.instance, "pacote", None))

        # O quanto há a cobrar neste atendimento, valendo para os dois ramos:
        # o serviço só é devido no avulso (no pacote ele foi pago na venda —
        # invariante 1), mas a corrida é devida sempre, porque é cobrada por viagem
        # e não faz parte da cota. Uma regra só evita que o ramo do pacote continue
        # sendo o buraco por onde o dinheiro da corrida escapa sem lançamento.
        valor = attrs.get("valor", getattr(self.instance, "valor", 0)) or 0

        # Sem corrida, sem valor de corrida. O faturamento soma `transporte_valor` sem
        # olhar o booleano; até aqui, quem garantia a coerência era só o formulário —
        # uma escrita pela API ou pelo admin com `transporte=False, transporte_valor=20`
        # faturava R$ 20 de uma viagem que nunca houve.
        tem_transporte = attrs.get(
            "transporte", getattr(self.instance, "transporte", False)
        )
        if not tem_transporte:
            attrs["transporte_valor"] = 0

        transporte = (
            attrs.get("transporte_valor", getattr(self.instance, "transporte_valor", 0)) or 0
        )

        # O pacote tem que ser do MESMO pet. O formulário nunca erra isso, mas a API
        # aceitava consumir crédito do pacote de outro pet — e o saldo de quem pagou
        # sumia sem explicação.
        pet = attrs.get("pet", getattr(self.instance, "pet", None))
        if pacote is not None and pet is not None and pacote.pet_id != pet.id:
            raise serializers.ValidationError("O pacote pertence a outro pet.")

        devido = transporte if pacote else valor + transporte

        pagamentos = attrs.get("pagamentos", [])
        if pagamentos and sum(p.get("valor", 0) for p in pagamentos) != devido:
            raise serializers.ValidationError(
                "A soma dos pagamentos deve ser igual ao valor cobrado "
                "(serviço + transporte; no pacote, só o transporte)."
            )

        if pacote is not None:
            status = attrs.get("status", getattr(self.instance, "status", None))
            ocupa_credito = status != models.Atendimento.Status.CANCELADO
            # Créditos ocupados por OUTROS atendimentos: no update, exclui o próprio,
            # senão editar um atendimento que já ocupa o crédito daria 400 indevido.
            ocupados = pacote.atendimentos.exclude(status=models.Atendimento.Status.CANCELADO)
            if self.instance is not None:
                ocupados = ocupados.exclude(pk=self.instance.pk)
            if ocupa_credito and pacote.qtd_total - ocupados.count() <= 0:
                raise serializers.ValidationError(
                    "O pacote não possui saldo suficiente para este atendimento."
                )

        return attrs