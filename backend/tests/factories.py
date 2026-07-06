from datetime import date, time
from decimal import Decimal

import factory

from core import models


class TutorFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Tutor

    nome = factory.Sequence(lambda n: f"Tutor {n}")
    telefone = "71999367531"


class PetFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Pet

    tutor = factory.SubFactory(TutorFactory)
    nome = factory.Sequence(lambda n: f"Pet {n}")
    raca = "SRD"


class ServicoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Servico

    nome = factory.Sequence(lambda n: f"Serviço {n}")
    preco_padrao = Decimal("95.00")


class PacoteContratadoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.PacoteContratado
        
    pet = factory.SubFactory(PetFactory)
    servico = factory.SubFactory(ServicoFactory, is_pacote=True, creditos=4)
    valor_pago = Decimal("95.00")
    validade = date(2026, 7, 30)
    
    
class AtendimentoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Atendimento
        
    pet = factory.SubFactory(PetFactory)
    servico = factory.SubFactory(ServicoFactory, is_pacote=False)
    valor = Decimal("95.00")
    horario = time(10, 0)
    data = date(2026, 7, 30)
    
    