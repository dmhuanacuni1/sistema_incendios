from flask import Blueprint

from app.controllers import auth_controller
from app.middleware.auth import login_requerido

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/registro")
def registro():
    return auth_controller.registro()


@auth_bp.post("/login")
def login():
    return auth_controller.login()


@auth_bp.post("/recuperar")
def recuperar():
    return auth_controller.recuperar()


@auth_bp.post("/restablecer")
def restablecer():
    return auth_controller.restablecer()


@auth_bp.post("/refresh")
def refresh():
    return auth_controller.refresh()


@auth_bp.get("/me")
@login_requerido
def me():
    from flask import g

    return auth_controller.me(g.usuario)


@auth_bp.post("/contrasena")
@login_requerido
def contrasena():
    from flask import g

    return auth_controller.contrasena(g.usuario)
