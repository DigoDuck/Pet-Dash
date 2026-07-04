from django.contrib import admin

from .models import Pet, Servico, Tutor


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
