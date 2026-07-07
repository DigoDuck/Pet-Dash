from rest_framework import serializers

from . import models


class TutorSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Tutor
        fields = ["id", "nome", "telefone", "email", "ativo", "created_at"]
        read_only_fields = ["ativo", "created_at"]


class PetSerializer(serializers.ModelSerializer):
    tutor_nome = serializers.CharField(source="tutor.nome", read_only=True)

    class Meta:
        model = models.Pet
        fields = [
            "id", "tutor", "tutor_nome", "nome", "raca", "porte", "ativo", "created_at",
        ]
        read_only_fields = ["ativo", "created_at"]


class ServicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Servico
        fields = ["id", "nome", "preco_padrao", "is_pacote", "creditos", "ativo"]


class PagamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Pagamento
        fields = ["id", "metodo", "valor"]


class AtendimentoSerializer(serializers.ModelSerializer):
    pagamentos = PagamentoSerializer(many=True, required=False)

    class Meta:
        model = models.Atendimento
        fields = [
            "id", "pet", "servico", "pacote", "data", "horario", "valor",
            "transporte", "transporte_valor", "status", "pagamentos",
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
