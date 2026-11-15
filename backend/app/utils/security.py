from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app
from werkzeug.security import check_password_hash, generate_password_hash

ALGORITMO = "HS256"


def hash_contrasena(contrasena):
    return generate_password_hash(contrasena, method="scrypt")


def verificar_contrasena(hash_guardado, contrasena):
    try:
        return check_password_hash(hash_guardado, contrasena)
    except (TypeError, ValueError):
        return False


def marca_hash(hash_guardado):
    return (hash_guardado or "")[-16:]


def _secreto():
    secreto = current_app.config.get("SECRET_KEY")
    if not secreto:
        raise RuntimeError("Falta SECRET_KEY en el entorno")
    return secreto


def crear_token(usuario, tipo, vigencia):
    ahora = datetime.now(timezone.utc)
    payload = {
        "sub": str(usuario.id_usuario),
        "tipo": tipo,
        "ver": marca_hash(usuario.hash_contrasena),
        "iat": ahora,
        "exp": ahora + vigencia,
    }
    return jwt.encode(payload, _secreto(), algorithm=ALGORITMO)


def crear_sesion(usuario):
    minutos = current_app.config["JWT_ACCESS_MINUTES"]
    dias = current_app.config["JWT_REFRESH_DAYS"]
    return {
        "access_token": crear_token(usuario, "access", timedelta(minutes=minutos)),
        "refresh_token": crear_token(usuario, "refresh", timedelta(days=dias)),
    }


def decodificar_token(token, tipo_esperado):
    try:
        payload = jwt.decode(token, _secreto(), algorithms=[ALGORITMO])
    except jwt.PyJWTError as exc:
        raise ValueError("Token inválido o vencido") from exc
    if payload.get("tipo") != tipo_esperado:
        raise ValueError("Token inválido o vencido")
    return payload
