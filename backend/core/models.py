from django.db import models


class Tutor(models.Model):
    nome = models.CharField(max_length=120)
    telefone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, default="")
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "tutores"

    def __str__(self):
        return self.nome


class Pet(models.Model):
    class Porte(models.TextChoices):
        PEQUENO = "P", "Pequeno"
        MEDIO = "M", "Médio"
        GRANDE = "G", "Grande"

    tutor = models.ForeignKey(Tutor, on_delete=models.PROTECT, related_name="pets")
    nome = models.CharField(max_length=80)
    raca = models.CharField(max_length=80, blank=True, default="")
    porte = models.CharField(max_length=1, choices=Porte.choices, blank=True, default="")
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nome} ({self.tutor.nome})"


class Servico(models.Model):
    nome = models.CharField(max_length=100)
    # Só sugestão de preenchimento; Atendimento.valor é o snapshot que vale.
    preco_padrao = models.DecimalField(max_digits=8, decimal_places=2)
    is_pacote = models.BooleanField(default=False)
    creditos = models.PositiveSmallIntegerField(null=True, blank=True)
    ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "servicos"

    def __str__(self):
        return self.nome
