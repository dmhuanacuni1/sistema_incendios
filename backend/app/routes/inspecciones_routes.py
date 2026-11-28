from flask import Blueprint
from app.controllers import inspecciones_controller as controller

inspecciones_bp = Blueprint("inspecciones", __name__)
inspecciones_bp.add_url_rule("", view_func=controller.listar, methods=["GET"])
inspecciones_bp.add_url_rule("", view_func=controller.crear, methods=["POST"])
inspecciones_bp.add_url_rule("/zona/<int:id_zona>", view_func=controller.por_zona, methods=["GET"])
