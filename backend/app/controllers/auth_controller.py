from flask import jsonify, request

from app.services import auth_service
from app.utils.errores import ErrorApp


def _datos():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def registro():
    try:
        return jsonify(auth_service.registrar_ciudadano(_datos())), 201
    except ErrorApp as exc:
        return jsonify({"error": exc.mensaje}), exc.codigo


def login():
    try:
        return jsonify(auth_service.iniciar_sesion(_datos()))
    except ErrorApp as exc:
        return jsonify({"error": exc.mensaje}), exc.codigo


def refresh():
    try:
        return jsonify(auth_service.renovar_sesion(_datos()))
    except ErrorApp as exc:
        return jsonify({"error": exc.mensaje}), exc.codigo


def me(usuario):
    return jsonify(auth_service.perfil(usuario))


def recuperar():
    try:
        return jsonify(auth_service.pedir_recuperacion(_datos()))
    except ErrorApp as exc:
        return jsonify({"error": exc.mensaje}), exc.codigo


def restablecer():
    try:
        return jsonify(auth_service.restablecer_contrasena(_datos()))
    except ErrorApp as exc:
        return jsonify({"error": exc.mensaje}), exc.codigo


def contrasena(usuario):
    try:
        sesion = auth_service.cambiar_contrasena(usuario, _datos())
    except ErrorApp as exc:
        return jsonify({"error": exc.mensaje}), exc.codigo
    return jsonify(sesion)
