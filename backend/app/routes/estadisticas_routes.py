
"""Rutas Blueprint del modulo de estadisticas."""

from flask import Blueprint

from app.controllers.estadisticas_controller import (
    EstadisticasController
)

from app.middleware.auth import rol_requerido


# Blueprint del modulo
estadisticas_bp = Blueprint(
    "estadisticas",
    __name__,
    url_prefix="/api/estadisticas"
)


# Instancia del controlador
_controller = EstadisticasController()


# Consultar estadisticas
@estadisticas_bp.get("")
@rol_requerido("ADMINISTRADOR")
def consultar_estadisticas():
    return _controller.consultar()
