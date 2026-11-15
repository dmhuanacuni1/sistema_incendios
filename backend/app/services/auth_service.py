from app.models.usuario import Usuario
from app.services import usuarios_service
from app.utils.errores import ErrorApp
from app.utils.security import crear_sesion, decodificar_token, marca_hash
from app.views.usuario_view import sesion_a_dict, usuario_a_dict
from app.config.database import db


def _sesion(usuario):
    return sesion_a_dict(usuario, crear_sesion(usuario))


def registrar_ciudadano(data):
    if not isinstance(data, dict):
        raise ErrorApp("El cuerpo de la solicitud no es válido")
    usuario = usuarios_service.crear_usuario(data, "CIUDADANO")
    return _sesion(usuario)


def iniciar_sesion(data):
    if not isinstance(data, dict):
        raise ErrorApp("El cuerpo de la solicitud no es válido")
    nombre = data.get("nombre_usuario", "")
    contrasena = data.get("contrasena")
    usuario = usuarios_service.buscar_por_nombre(nombre)
    if not usuarios_service.contrasena_correcta(usuario, contrasena):
        raise ErrorApp("Usuario o contraseña incorrectos", 401)
    usuarios_service.exigir_activo(usuario)
    return _sesion(usuario)


def renovar_sesion(data):
    if not isinstance(data, dict):
        raise ErrorApp("El cuerpo de la solicitud no es válido")
    token = data.get("refresh_token")
    if not isinstance(token, str) or not token.strip():
        raise ErrorApp("Refresh token requerido")
    try:
        payload = decodificar_token(token.strip(), "refresh")
        id_usuario = int(payload["sub"])
    except (ValueError, TypeError, KeyError):
        raise ErrorApp("La sesión expiró. Vuelve a iniciar sesión", 401)

    usuario = db.session.get(Usuario, id_usuario)
    if usuario is None or payload.get("ver") != marca_hash(usuario.hash_contrasena):
        raise ErrorApp("La sesión expiró. Vuelve a iniciar sesión", 401)
    usuarios_service.exigir_activo(usuario)
    return _sesion(usuario)


def perfil(usuario):
    return usuario_a_dict(usuario)


def cambiar_contrasena(usuario, data):
    if not isinstance(data, dict):
        raise ErrorApp("El cuerpo de la solicitud no es válido")
    actual = data.get("contrasena_actual")
    nueva = data.get("contrasena_nueva")
    if not usuarios_service.contrasena_correcta(usuario, actual):
        raise ErrorApp("La contraseña actual no coincide")
    if actual == nueva:
        raise ErrorApp("La contraseña nueva debe ser distinta")
    usuarios_service.cambiar_hash(usuario, nueva)
    return _sesion(usuario)
