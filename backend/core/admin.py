from django.contrib import admin

from .models import (
    Atendimento,
    Custo,
    PacoteContratado,
    Pagamento,
    Pet,
    Retirada,
    Servico,
    Tutor,
)


@admin.register(Tutor)
class TutorAdmin(admin.ModelAdmin):
    list_display = ["nome", "telefone", "ativo"]
    search_fields = ["nome", "telefone"]


@admin.register(Pet)
class PetAdmin(admin.ModelAdmin):
    list_display = ["nome", "tutor", "raca", "porte", "ativo"]
    search_fields = ["nome", "tutor__nome"]
    list_filter = ["porte", "ativo"]


@admin.register(Servico)
class ServicoAdmin(admin.ModelAdmin):
    list_display = ["nome", "preco_padrao", "is_pacote", "creditos", "ativo"]
    list_filter = ["is_pacote", "ativo"]


@admin.register(PacoteContratado)
class PacoteContratadoAdmin(admin.ModelAdmin):
    list_display = ["pet", "competencia", "qtd_total", "valor_pago", "validade", "ativo"]
    list_filter = ["competencia", "ativo"]
    search_fields = ["pet__nome"]


class PagamentoInline(admin.TabularInline):
    model = Pagamento
    extra = 0


@admin.register(Atendimento)
class AtendimentoAdmin(admin.ModelAdmin):
    list_display = ["pet", "servico", "data", "valor", "status", "pacote"]
    list_filter = ["status", "data"]
    search_fields = ["pet__nome", "pet__tutor__nome"]
    inlines = [PagamentoInline]


@admin.register(Custo)
class CustoAdmin(admin.ModelAdmin):
    list_display = ["descricao", "tipo", "valor", "categoria", "competencia"]
    list_filter = ["tipo", "competencia"]


@admin.register(Retirada)
class RetiradaAdmin(admin.ModelAdmin):
    list_display = ["descricao", "valor", "data", "tipo"]
