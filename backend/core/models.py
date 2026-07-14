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
        # A Patricia precifica por PESO, não por porte subjetivo. Os rótulos carregam
        # a faixa dela para o campo não virar chute de quem cadastra. A tabela original
        # pula de "até 10kg" para "12 a 15kg"; a faixa média foi fechada em 10–15kg
        # para não existir pet sem preço (decisão do Diogo, a confirmar com ela).
        PEQUENO = "P", "Pequeno (até 10 kg)"
        MEDIO = "M", "Médio (10 a 15 kg)"
        GRANDE = "G", "Grande (acima de 15 kg)"

    tutor = models.ForeignKey(Tutor, on_delete=models.PROTECT, related_name="pets")
    nome = models.CharField(max_length=80)
    raca = models.CharField(max_length=80, blank=True, default="")
    porte = models.CharField(max_length=1, choices=Porte.choices, blank=True, default="")
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nome} ({self.tutor.nome})"


class Servico(models.Model):
    """Catálogo. Os três preços são SUGESTÃO de preenchimento, nunca fonte de verdade:
    `Atendimento.valor` é o snapshot do que foi cobrado no dia (invariante 7).

    Vários itens da tabela da Patricia são "a partir de" (tosa na lâmina, tosa na
    tesoura, desembolo). Como o preço aqui é só sugestão, o piso serve bem — ela
    ajusta na tela quando a pelagem pede mais.
    """

    nome = models.CharField(max_length=100)
    # Faixa de peso da Patricia. `preco_padrao` mantém o nome por compatibilidade,
    # mas é o preço do PEQUENO (até 10 kg) — não um preço "geral".
    preco_padrao = models.DecimalField(
        max_digits=8, decimal_places=2, help_text="Preço para pet pequeno (até 10 kg)."
    )
    preco_m = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        help_text="Preço para pet médio (10 a 15 kg). Vazio usa o preço do pequeno.",
    )
    preco_g = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        help_text="Preço para pet grande (acima de 15 kg). Vazio usa o preço do pequeno.",
    )
    is_pacote = models.BooleanField(default=False)
    creditos = models.PositiveSmallIntegerField(null=True, blank=True)
    ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "servicos"

    def __str__(self):
        return self.nome

    def preco_para(self, porte):
        """Sugestão de preço para o porte do pet, caindo no preço do pequeno quando a
        faixa não tem preço próprio. Nunca devolve None: um campo de preço vazio no
        formulário faria a Patricia digitar do zero em todo atendimento."""
        if porte == Pet.Porte.MEDIO and self.preco_m is not None:
            return self.preco_m
        if porte == Pet.Porte.GRANDE and self.preco_g is not None:
            return self.preco_g
        return self.preco_padrao


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
    # Pet agressivo ou que exige contenção especial: +40% sobre o serviço (tempo extra
    # e manejo diferenciado). O flag NÃO recalcula `valor` no backend — `valor` é o
    # snapshot do que foi cobrado (invariante 7). Ele existe para sugerir o preço com
    # o acréscimo no formulário, e para a Patricia conseguir contar os casos depois.
    manejo_especial = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDENTE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    objects = AtendimentoQuerySet.as_manager()
    
    def __str__(self):
        return f"{self.servico} ({self.pet.nome}) {self.data}"


class Pagamento(models.Model):
    class Metodo(models.TextChoices):
        PIX = "Pix", "Pix"
        CARTAO = "Cartao", "Cartão"
        DINHEIRO = "Dinheiro", "Dinheiro"

    atendimento = models.ForeignKey(
        Atendimento, on_delete=models.CASCADE, related_name="pagamentos"
    )
    metodo = models.CharField(max_length=10, choices=Metodo.choices)
    valor = models.DecimalField(max_digits=8, decimal_places=2)

    def __str__(self):
        return f"{self.metodo} · R$ {self.valor}"


class Custo(models.Model):
    class Tipo(models.TextChoices):
        FIXO = "fixo", "Fixo"
        VARIAVEL = "variavel", "Variável"

    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    descricao = models.CharField(max_length=200)
    valor = models.DecimalField(max_digits=8, decimal_places=2)
    categoria = models.CharField(max_length=60, blank=True, default="")
    competencia = models.DateField(help_text="Dia 1 do mês de referência")

    def __str__(self):
        return f"{self.descricao} · {self.competencia:%m/%Y}"

    def save(self, *args, **kwargs):
        # O código inteiro assume competência = dia 1 (`serie_mensal` casa exato, a tela
        # do Financeiro filtra `?competencia=2026-07-01`). Um custo lançado com dia 15
        # pelo admin entrava no KPI do mês (que usa `__range`) e sumia do gráfico e da
        # lista — divergência silenciosa entre dois números da mesma tela. O
        # PacoteContratado já normalizava; o Custo confiava no formulário.
        self.competencia = self.competencia.replace(day=1)
        super().save(*args, **kwargs)


class Retirada(models.Model):
    descricao = models.CharField(max_length=200)
    valor = models.DecimalField(max_digits=8, decimal_places=2)
    data = models.DateField()
    tipo = models.CharField(max_length=60, blank=True, default="")

    def __str__(self):
        return f"{self.descricao} · {self.data}"
    
    