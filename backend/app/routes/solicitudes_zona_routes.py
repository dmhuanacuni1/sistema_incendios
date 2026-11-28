from flask import Blueprint
from app.controllers import solicitudes_zona_controller as controller

solicitudes_zona_bp = Blueprint("solicitudes_zona", __name__)
solicitudes_zona_bp.add_url_rule("", view_func=controller.listar, methods=["GET"])
solicitudes_zona_bp.add_url_rule("", view_func=controller.crear, methods=["POST"])
solicitudes_zona_bp.add_url_rule("/mias", view_func=controller.mias, methods=["GET"])
solicitudes_zona_bp.add_url_rule("/pendientes", view_func=controller.pendientes, methods=["GET"])
solicitudes_zona_bp.add_url_rule("/<int:id_solicitud>/evaluacion", view_func=controller.evaluar, methods=["PATCH"])
solicitudes_zona_bp.add_url_rule("/<int:id_solicitud>", view_func=controller.eliminar, methods=["DELETE"])
