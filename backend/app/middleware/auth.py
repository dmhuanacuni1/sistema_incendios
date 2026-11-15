from functools import wraps

from flask import g, jsonify, request

from app.config.database import db
from app.models.usuario import Usuario
from app.utils.security import decodificar_token, marca_hash


def _usuario_desde_token(tipo):
    encabezado = request.headers.get("Authorization", "")
    if not encabezado.startswith("Bearer "):
        return None, (jsonify({"error": "Debes iniciar sesión"}), 401)
    try:
        payload = decodificar_token(encabezado[7:].strip(), tipo)
        id_usuario = int(payload["sub"])
    except (ValueError, TypeError, KeyError):
        return None, (jsonify({"error": "La sesión expiró. Vuelve a iniciar sesión"}), 401)

    usuario = db.session.get(Usuario, id_usuario)
    if usuario is None or payload.get("ver") != marca_hash(usuario.hash_contrasena):
        return None, (jsonify({"error": "La sesión expiró. Vuelve a iniciar sesión"}), 401)
    if usuario.estado != "ACTIVO":
        return None, (jsonify({"error": "La cuenta no está activa"}), 403)
    return usuario, None


def login_requerido(funcion):
    @wraps(funcion)
    def envoltura(*args, **kwargs):
        usuario, error = _usuario_desde_token("access")
        if error:
            return error
        g.usuario = usuario
        return funcion(*args, **kwargs)

    return envoltura


def rol_requerido(*roles):
    def decorador(funcion):
        @wraps(funcion)
        @login_requerido
        def envoltura(*args, **kwargs):
            if g.usuario.rol.nombre_rol not in roles:
                return jsonify({"error": "No tienes permiso para esta acción"}), 403
            return funcion(*args, **kwargs)

        return envoltura

    return decorador
