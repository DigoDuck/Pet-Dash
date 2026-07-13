from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("tutores", views.TutorViewSet, basename="tutor")
router.register("pets", views.PetViewSet, basename="pet")
router.register("servicos", views.ServicoViewSet, basename="servico")
router.register("atendimentos", views.AtendimentoViewSet, basename="atendimento")
router.register("pacotes", views.PacoteContratadoViewSet, basename="pacote")
router.register("custos", views.CustoViewSet, basename="custo")
router.register("retiradas", views.RetiradaViewSet, basename="retirada")

urlpatterns = [
    path("health/", views.healthcheck, name="health"),
    path("dashboard/", views.DashboardView.as_view(), name="dashboard"),
    path("dashboard/serie/", views.SerieMensalView.as_view(), name="dashboard-serie"),
    path("", include(router.urls)),
]
