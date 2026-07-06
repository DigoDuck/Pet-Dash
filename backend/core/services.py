from decimal import Decimal

from django.db.models import Sum

from core.models import Atendimento, PacoteContratado


def faturamento_periodo(inicio, fim):
    pacotes = PacoteContratado.objects.filter(
        data_compra__gte=inicio, data_compra__lte=fim
    ).aggregate(total=Sum("valor_pago"))["total"] or Decimal("0")

    avulsos = (
        Atendimento.objects.avulsos().liberados().no_periodo(inicio, fim)
        .aggregate(total=Sum("valor"))["total"]
        or Decimal("0")
)

    return pacotes + avulsos