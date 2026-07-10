from datetime import date, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core.models import Atendimento, Pet, Servico, Tutor

TUTORES = [
    ("Ana Clara Souza", "71988880001", "ana@exemplo.com"),
    ("Rafael Lima", "71988880002", "rafael@exemplo.com"),
    ("Camila Duarte", "71988880003", ""),
    ("Bruno Teixeira", "71988880004", ""),
]

# (nome, indice do tutor, raça, porte)
PETS = [
    ("Luna", 0, "Shih Tzu", "P"),
    ("Thor", 0, "Golden Retriever", "G"),
    ("Mel", 1, "Poodle", "P"),
    ("Nina", 2, "SRD", "M"),
    ("Bob", 3, "Beagle", "M"),
    ("Pipoca", 3, "Lhasa Apso", "P"),
]

SERVICOS = [
    ("Banho", Decimal("60.00"), False, None),
    ("Banho e Tosa", Decimal("95.00"), False, None),
    ("Pacote Fidelidade", Decimal("220.00"), True, 4),
]


class Command(BaseCommand):
    help = "Popula o banco com dados fictícios para desenvolvimento local."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_dev só roda com DEBUG=True. Abortado.")

        hoje = date.today()

        servicos = {}
        for nome, preco, is_pacote, creditos in SERVICOS:
            servicos[nome], _ = Servico.objects.get_or_create(
                nome=nome,
                defaults={"preco_padrao": preco, "is_pacote": is_pacote, "creditos": creditos},
            )

        tutores = []
        for nome, telefone, email in TUTORES:
            tutor, _ = Tutor.objects.get_or_create(
                nome=nome, defaults={"telefone": telefone, "email": email}
            )
            tutores.append(tutor)

        pets = []
        for nome, indice, raca, porte in PETS:
            pet, _ = Pet.objects.get_or_create(
                nome=nome,
                tutor=tutores[indice],
                defaults={"raca": raca, "porte": porte},
            )
            pets.append(pet)

        # Luna (0): VIP por 3 banhos na janela. Mel (2): VIP por um atendimento
        # de R$600. Thor (1): comum. Nina (3): um atendimento de 400 dias atrás,
        # fora da janela de 365 -> não-VIP. Bob (4) e Pipoca (5): sem atendimento,
        # para provar na tela que pets sem histórico não somem da lista.
        agenda = [
            (pets[0], "Banho", 60, 7),
            (pets[0], "Banho", 60, 21),
            (pets[0], "Banho e Tosa", 95, 35),
            (pets[2], "Banho e Tosa", 600, 14),
            (pets[1], "Banho", 60, 10),
            (pets[3], "Banho", 60, 400),  # fora da janela de 365 dias
        ]
        # As datas são relativas a hoje, então a chave (pet, servico, data) muda
        # de um dia para o outro; um get_or_create criaria duplicatas a cada
        # rerun. Recriar do zero os atendimentos dos pets do seed mantém o
        # comando idempotente em qualquer dia (só roda com DEBUG).
        Atendimento.objects.filter(pet__in=pets).delete()
        for pet, servico, valor, dias_atras in agenda:
            Atendimento.objects.create(
                pet=pet,
                servico=servicos[servico],
                data=hoje - timedelta(days=dias_atras),
                horario=time(10, 0),
                valor=Decimal(valor),
                status=Atendimento.Status.LIBERADO,
            )

        # Contadores locais (o que o seed garante), não contagem global do banco:
        # a mensagem não muda se já houver outros dados no dev.
        self.stdout.write(
            self.style.SUCCESS(
                f"Seed pronto: {len(tutores)} tutores, {len(pets)} pets, "
                f"{len(agenda)} atendimentos."
            )
        )
