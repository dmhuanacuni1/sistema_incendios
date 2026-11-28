"""
Blueprint de rutas para Zonas de Riesgo.
Prefijo: /api/zonas-riesgo
"""

from flask import Blueprint
from app.controllers import zona_riesgo_controller

zona_riesgo_bp = Blueprint("zona_riesgo", __name__)

# CU07: Listado/visor geoespacial
zona_riesgo_bp.add_url_rule("", view_func=zona_riesgo_controller.listar_zonas, methods=["GET"])

# CU03: Crear zona con poligono
zona_riesgo_bp.add_url_rule("", view_func=zona_riesgo_controller.crear_zona, methods=["POST"])

# CU09: Focos de calor satelitales (ruta fija antes de <id_zona> para evitar colision)
zona_riesgo_bp.add_url_rule("/focos-calor", view_func=zona_riesgo_controller.listar_focos_calor, methods=["GET"])

# Mapa general: focos de calor satelitales y areas quemadas (todos los roles)
zona_riesgo_bp.add_url_rule("/focos-satelitales", view_func=zona_riesgo_controller.focos_satelitales, methods=["GET"])
zona_riesgo_bp.add_url_rule("/areas-quemadas", view_func=zona_riesgo_controller.areas_quemadas, methods=["GET"])

# Resolucion de enlaces de Google Maps a coordenadas GPS
zona_riesgo_bp.add_url_rule("/resolver-ubicacion", view_func=zona_riesgo_controller.resolver_ubicacion, methods=["POST"])

# Detalle individual
zona_riesgo_bp.add_url_rule("/<int:id_zona>", view_func=zona_riesgo_controller.detalle_zona, methods=["GET"])

# Edicion
zona_riesgo_bp.add_url_rule("/<int:id_zona>", view_func=zona_riesgo_controller.actualizar_zona, methods=["PUT"])

# Exclusivo del administrador: eliminar una zona registrada.
zona_riesgo_bp.add_url_rule("/<int:id_zona>", view_func=zona_riesgo_controller.eliminar_zona, methods=["DELETE"])

# CU10: Emitir alerta COE
zona_riesgo_bp.add_url_rule("/<int:id_zona>/alerta", view_func=zona_riesgo_controller.emitir_alerta, methods=["POST"])


# Comparativa de superficie quemada por departamento
zona_riesgo_bp.add_url_rule("/superficie-quemada", view_func=zona_riesgo_controller.superficie_quemada, methods=["GET"])

# Activar / Inactivar zona con historial
zona_riesgo_bp.add_url_rule(
    "/<int:id_zona>/estado",
    view_func=zona_riesgo_controller.cambiar_estado_zona,
    methods=["PATCH"]
)

# Consultar historial de activaciones e inactivaciones
zona_riesgo_bp.add_url_rule(
    "/<int:id_zona>/historial",
    view_func=zona_riesgo_controller.consultar_historial_zona,
    methods=["GET"]
)
