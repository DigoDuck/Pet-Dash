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
