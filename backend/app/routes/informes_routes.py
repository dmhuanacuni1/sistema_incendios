"""Rutas Blueprint del modulo de informes."""

from flask import Blueprint

from app.controllers.informes_controller import (
    InformesController,
)

from app.middleware.auth import rol_requerido


# Blueprint del modulo
informes_bp = Blueprint(
    "informes",
    __name__,
    url_prefix="/api/informes",
)


# Instancia del controlador
_controller = InformesController()


# Generar y almacenar un informe
@informes_bp.post("")
@rol_requerido("ADMINISTRADOR")
def generar_informe():
    return _controller.generar()


# Consultar historial de informes
@informes_bp.get("")
@rol_requerido("ADMINISTRADOR")
def listar_informes():
    return _controller.listar()


# Consultar detalle de un informe
@informes_bp.get("/<int:id_reporte>")
@rol_requerido("ADMINISTRADOR")
def detalle_informe(id_reporte):
    return _controller.detalle(id_reporte)


# Descargar el archivo original
@informes_bp.get("/<int:id_reporte>/descargar")
@rol_requerido("ADMINISTRADOR")
def descargar_informe(id_reporte):
    return _controller.descargar(id_reporte)

# Consultar el contenido original de un informe Excel
@informes_bp.get("/<int:id_reporte>/contenido")
@rol_requerido("ADMINISTRADOR")
def contenido_informe(id_reporte):
    return _controller.contenido(id_reporte)

# Generar un informe sin exportarlo
@informes_bp.post("/generar")
@rol_requerido("ADMINISTRADOR")
def generar_informe_estructurado():
    return _controller.generar(estructurado=True)


# Exportar un informe en PDF o Excel
@informes_bp.get("/<int:id_reporte>/exportar")
@rol_requerido("ADMINISTRADOR")
def exportar_informe(id_reporte):
    return _controller.exportar(id_reporte)