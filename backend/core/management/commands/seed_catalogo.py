from decimal import Decimal

from django.core.management.base import BaseCommand

from core.models import Servico

# Catálogo real do Ângelo Spa Animal, da tabela de preços que a Patricia mandou
# (julho/2026). Ela precifica por FAIXA DE PESO, não por porte subjetivo:
#
#   pequeno = até 10 kg · médio = 10 a 15 kg · grande = acima de 15 kg
#
# A tabela dela pula de "até 10kg" para "12 a 15kg"; a faixa média foi fechada em
# 10–15kg para não existir pet sem preço. Confirmar com ela.
#
# Os preços de até 10 kg batem exatamente com a moda dos 510 atendimentos da planilha
# (banho 65, higiênica 75, lâmina 85, embolada 120, tesoura 120) — os nomes que ela
# usava na planilha eram apelidos destes serviços.
#
# Acima de 15 kg ela deu só o verbal: "Golden, Dálmata, Labrador a partir de 150" e
# "Chow Chow de 300 a 350" (que é caso de pelagem, não de peso). Por isso só o banho
# tem preço de grande; nos outros, `preco_g` fica vazio e o sistema sugere o preço do
# pequeno — sugestão errada por baixo, que ela corrige na tela, é melhor do que um
# número que eu inventei.
#
# Vários itens são "a partir de" (lâmina 7, tesoura, desembolo). Como o preço aqui é
# só sugestão de preenchimento (invariante 7), o piso serve: ela ajusta no dia.
#
# NÃO estão no catálogo, de propósito:
# - Acréscimo de 40% (pet agressivo / contenção especial): é um multiplicador sobre o
#   serviço, não um serviço. Virou o checkbox `manejo_especial` no atendimento.
# - Acréscimo de R$ 25 do banho medicinal obrigatório quando se encontra parasita: é
#   um acréscimo fixo sobre o banho, aplicado na hora. Ela digita o valor.
# - Juros da maquininha no cartão: muda o que ela RECEBE, não o que cobra. Fora do MVP.
#
# (nome, preco_padrao (≤10kg), preco_m (10–15kg), preco_g (>15kg), is_pacote, creditos)
CATALOGO = [
    ("Banho", Decimal("65.00"), Decimal("120.00"), Decimal("150.00"), False, None),
    ("Banho medicinal", Decimal("85.00"), Decimal("135.00"), None, False, None),
    ("Banho + Tosa higiênica", Decimal("75.00"), Decimal("180.00"), None, False, None),
    ("Tosa na lâmina 7", Decimal("85.00"), Decimal("180.00"), None, False, None),
    ("Tosa de pelagem embolada", Decimal("120.00"), Decimal("199.00"), None, False, None),
    ("Tosa na tesoura (bebê)", Decimal("120.00"), Decimal("250.00"), None, False, None),
    ("Desembolo", Decimal("30.00"), None, None, False, None),
    ("Hidratação", Decimal("30.00"), None, None, False, None),
    # Não está na tabela nova; preço da planilha (jun/jul), a confirmar com ela.
    ("Corte de unhas", Decimal("20.00"), None, None, False, None),
    # Idem: preço vigente na planilha. Todos os 18 pacotes vendidos em 4 meses foram
    # para pet pequeno, então não há dado de pacote por faixa.
    ("Pacote Fidelidade", Decimal("290.00"), None, None, True, 4),
]


class Command(BaseCommand):
    help = "Cria o catálogo real de serviços. Idempotente; roda em produção."

    def handle(self, *args, **options):
        # Sem guard de DEBUG, ao contrário do seed_dev: este comando existe justamente
        # para rodar em produção. A proteção contra duplicar é o get_or_create, e não
        # um ambiente.
        criados = 0

        for nome, preco, preco_m, preco_g, is_pacote, creditos in CATALOGO:
            # get_or_create, nunca update_or_create: se a Patricia já corrigiu o preço
            # de um serviço pela tela, rodar o seed de novo não pode desfazer a
            # correção dela. Re-rodar é no-op, por construção.
            _, novo = Servico.objects.get_or_create(
                nome=nome,
                defaults={
                    "preco_padrao": preco,
                    "preco_m": preco_m,
                    "preco_g": preco_g,
                    "is_pacote": is_pacote,
                    "creditos": creditos,
                },
            )
            criados += novo
            self.stdout.write(f"  {'criado ' if novo else 'existia'}  {nome}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Catálogo: {criados} criado(s), {len(CATALOGO) - criados} já existia(m)."
            )
        )
