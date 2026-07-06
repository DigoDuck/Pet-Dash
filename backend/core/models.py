import datetime

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


class PacoteContratado(models.Model):
    pet = models.ForeignKey(Pet, on_delete=models.PROTECT, related_name="pacotes")
    servico = models.ForeignKey(Servico, on_delete=models.PROTECT, related_name="pacotes")
    competencia = models.DateField(default=datetime.date.today)
    qtd_total = models.PositiveSmallIntegerField(default=4)
    valor_pago = models.DecimalField(max_digits=8, decimal_places=2)
    data_compra = models.DateField(default=datetime.date.today)
    validade = models.DateField()
    ativo = models.BooleanField(default=True)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["pet", "competencia"], name="unique_pacote_pet_competencia"
                ),
        ]
    
    def __str__(self):
        return f"{self.servico} ({self.pet.nome}) {self.competencia:%m/%Y}"

    def save(self, *args, **kwargs):
        self.competencia = self.competencia.replace(day=1)
        super().save(*args, **kwargs)

    def saldo(self):
        return self.qtd_total - self.atendimentos.exclude(
            status=Atendimento.Status.CANCELADO
            ).count()


class AtendimentoQuerySet(models.QuerySet):
    def liberados(self):
        return self.filter(status=Atendimento.Status.LIBERADO)
    
    def avulsos(self):
        return self.filter(pacote__isnull=True)
    
    def no_periodo(self, inicio, fim):
        return self.filter(data__gte=inicio, data__lte=fim)


class Atendimento(models.Model):
    class Status(models.TextChoices):
        LIBERADO = "Liberado", "Liberado"
        PENDENTE = "Pendente", "Pendente"
        CANCELADO = "Cancelado", "Cancelado"
    
    pet = models.ForeignKey(Pet, on_delete=models.PROTECT, related_name="atendimentos")
    servico = models.ForeignKey(Servico, on_delete=models.PROTECT, related_name="atendimentos")
    pacote = models.ForeignKey(
        PacoteContratado,
        on_delete=models.PROTECT,
        related_name="atendimentos",
        null=True,
        blank=True)
    data = models.DateField(default=datetime.date.today)
    horario = models.TimeField()
    valor = models.DecimalField(max_digits=8, decimal_places=2)
    transporte = models.BooleanField(default=False)
    transporte_valor = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDENTE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    objects = AtendimentoQuerySet.as_manager()
    
    def __str__(self):
        return f"{self.servico} ({self.pet.nome}) {self.data}"
    
    