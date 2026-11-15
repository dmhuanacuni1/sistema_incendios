from flask import g, jsonify, request

from app.services import usuarios_service
from app.utils.errores import ErrorApp
from app.utils.security import crear_sesion
from app.views.usuario_view import usuario_a_dict


def _datos():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def listar():
    usuarios = usuarios_service.listar_usuarios()
    return jsonify([usuario_a_dict(usuario) for usuario in usuarios])


def crear():
    data = _datos()
    try:
        usuario = usuarios_service.crear_usuario(data, data.get("rol"))
    except ErrorApp as exc:
        return jsonify({"error": exc.mensaje}), exc.codigo
    return jsonify(usuario_a_dict(usuario)), 201


def actualizar(id_usuario):
    try:
        usuario, renovar = usuarios_service.actualizar_usuario(g.usuario, id_usuario, _datos())
    except ErrorApp as exc:
        return jsonify({"error": exc.mensaje}), exc.codigo
    cuerpo = usuario_a_dict(usuario)
    if renovar:
        cuerpo.update(crear_sesion(usuario))
    return jsonify(cuerpo)


def estado(id_usuario):
    try:
        usuario = usuarios_service.cambiar_estado(
            g.usuario,
            id_usuario,
            _datos().get("estado"),
        )
    except ErrorApp as exc:
        return jsonify({"error": exc.mensaje}), exc.codigo
    return jsonify(usuario_a_dict(usuario))
