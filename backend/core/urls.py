from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("tutores", views.TutorViewSet, basename="tutor")
router.register("pets", views.PetViewSet, basename="pet")
router.register("servicos", views.ServicoViewSet, basename="servico")

urlpatterns = [
    path("health/", views.healthcheck, name="health"),
    path("", include(router.urls)),
]
