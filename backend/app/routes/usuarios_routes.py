from flask import Blueprint

from app.controllers import usuarios_controller
from app.middleware.auth import rol_requerido

usuarios_bp = Blueprint("usuarios", __name__)


@usuarios_bp.get("/")
@rol_requerido("ADMINISTRADOR")
def listar():
    return usuarios_controller.listar()


@usuarios_bp.post("/")
@rol_requerido("ADMINISTRADOR")
def crear():
    return usuarios_controller.crear()


@usuarios_bp.patch("/<int:id_usuario>")
@rol_requerido("ADMINISTRADOR")
def actualizar(id_usuario):
    return usuarios_controller.actualizar(id_usuario)


@usuarios_bp.patch("/<int:id_usuario>/estado")
@rol_requerido("ADMINISTRADOR")
def estado(id_usuario):
    return usuarios_controller.estado(id_usuario)
