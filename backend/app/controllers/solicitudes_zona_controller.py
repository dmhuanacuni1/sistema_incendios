from flask import g, jsonify, request

from app.middleware.auth import rol_requerido
from app.services import solicitudes_zona_service


@rol_requerido("CIUDADANO")
def crear():
    try:
        solicitud = solicitudes_zona_service.crear_solicitud(
            g.usuario.id_persona, request.get_json(silent=True) or {}
        )
        return jsonify({"ok": True, "data": solicitud.to_dict(), "mensaje": "Solicitud enviada"}), 201
    except ValueError as error:
        return jsonify({"ok": False, "error": str(error)}), 400


@rol_requerido("CIUDADANO")
def mias():
    data = [s.to_dict() for s in solicitudes_zona_service.listar_solicitudes(id_ciudadano=g.usuario.id_persona)]
    return jsonify({"ok": True, "data": data, "total": len(data)}), 200


@rol_requerido("ADMINISTRADOR", "OPERADOR")
def listar():
    estado = request.args.get("estado")
    data = [s.to_dict() for s in solicitudes_zona_service.listar_solicitudes(estado=estado)]
    return jsonify({"ok": True, "data": data, "total": len(data)}), 200


@rol_requerido("ADMINISTRADOR", "OPERADOR")
def pendientes():
    data = [s.to_dict() for s in solicitudes_zona_service.listar_solicitudes(pendientes=True)]
    return jsonify({"ok": True, "data": data, "total": len(data)}), 200


@rol_requerido("ADMINISTRADOR", "OPERADOR")
def evaluar(id_solicitud):
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"ok": False, "error": "La evaluación debe enviarse como un objeto JSON"}), 400
    try:
        solicitud = solicitudes_zona_service.evaluar_solicitud(
            id_solicitud,
            g.usuario.id_persona,
            payload.get("estado"),
            payload.get("observacion", ""),
            payload.get("nivel_riesgo_final"),
        )
        if solicitud is None:
            return jsonify({"ok": False, "error": "Solicitud no encontrada"}), 404
        return jsonify({"ok": True, "data": solicitud.to_dict(), "mensaje": "Solicitud evaluada"}), 200
    except ValueError as error:
        return jsonify({"ok": False, "error": str(error)}), 400


@rol_requerido("ADMINISTRADOR", "OPERADOR")
def eliminar(id_solicitud):
    if not solicitudes_zona_service.eliminar_solicitud(id_solicitud):
        return jsonify({"ok": False, "error": "Solicitud no encontrada"}), 404
    return jsonify({"ok": True, "mensaje": "Solicitud eliminada"}), 200
