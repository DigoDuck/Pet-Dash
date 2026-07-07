from rest_framework import serializers

from . import models


class TutorSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Tutor
        fields = ["id", "nome", "telefone", "email", "ativo", "created_at"]
        read_only_fields = ["ativo", "created_at"]
