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
        return (
            self.get_qtd_visitas(obj) >= services.VIP_MIN_VISITAS
            or Decimal(self.get_total_gasto(obj)) >= services.VIP_MIN_GASTO
        )


class ServicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Servico
        fields = ["id", "nome", "preco_padrao", "is_pacote", "creditos", "ativo"]


class PagamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Pagamento
        fields = ["id", "metodo", "valor"]
        
        
class PacoteContratadoSerializer(serializers.ModelSerializer):
    saldo = serializers.SerializerMethodField()

    class Meta:
        model = models.PacoteContratado
        fields = [
            "id", "pet", "servico", "competencia", "qtd_total", "valor_pago",
            "data_compra", "validade", "saldo",
        ]

    def get_saldo(self, obj):
        return obj.saldo()

    def validate(self, attrs):
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


class DashboardSerializer(serializers.Serializer):
    # Todos os valores monetários saem como string ("315.00"), padrão DRF,
    # para o front não receber float e string misturados na mesma resposta.
    faturamento = serializers.DecimalField(max_digits=10, decimal_places=2)
    custos = serializers.DecimalField(max_digits=10, decimal_places=2)
    retiradas = serializers.DecimalField(max_digits=10, decimal_places=2)
    lucro = serializers.DecimalField(max_digits=10, decimal_places=2)
    ticket_medio = serializers.DecimalField(max_digits=10, decimal_places=2)
    margem = serializers.DecimalField(max_digits=6, decimal_places=4)


class AtendimentoSerializer(serializers.ModelSerializer):
    pagamentos = PagamentoSerializer(many=True, required=False)
    servico_nome = serializers.CharField(source="servico.nome", read_only=True)
    pet_nome = serializers.CharField(source="pet.nome", read_only=True)
    tutor_nome = serializers.CharField(source="pet.tutor.nome", read_only=True)

    class Meta:
        model = models.Atendimento
        fields = [
            "id", "pet", "pet_nome", "tutor_nome", "servico", "servico_nome",
            "pacote", "data", "horario", "valor", "transporte", "transporte_valor",
            "status", "pagamentos",
        ]

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

        if pacote is None:
            pagamentos = attrs.get("pagamentos", [])
            if pagamentos:
                valor_atendimento = attrs.get("valor", getattr(self.instance, "valor", 0))
                valor_pagamentos = sum(p.get("valor", 0) for p in pagamentos)
                if valor_atendimento != valor_pagamentos:
                    raise serializers.ValidationError(
                        "O valor do atendimento deve ser igual à soma dos pagamentos."
                    )
        else:
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