from flask import Blueprint
from app.controllers.alertas_controller import AlertasController
from app.middleware.auth import login_requerido

alertas_bp = Blueprint("alertas", __name__)
controller = AlertasController()

@alertas_bp.get("/mis-alertas")
@login_requerido
def mis_alertas():
    return controller.mis_alertas()

@alertas_bp.put("/<int:id_alerta>/confirmar")
@login_requerido
def confirmar(id_alerta):
    return controller.confirmar(id_alerta)

@alertas_bp.get("/historial")
@login_requerido
def historial():
    return controller.historial()