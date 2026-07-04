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
