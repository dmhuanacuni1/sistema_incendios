"""
Controladores para el modulo Gestion de Zonas de Riesgo.
Manejo de errores HTTP y serializacion de respuestas.
"""

from flask import request, jsonify, g
from app.services import mapa_service, riesgo_service
from app.middleware.auth import rol_requerido


@rol_requerido("ADMINISTRADOR", "OPERADOR", "BOMBERO", "CIUDADANO")
def listar_zonas():
    """GET /api/zonas-riesgo - CU07: Visor geoespacial."""
    try:
        nivel = request.args.get("nivel_riesgo")
        estado = request.args.get("estado")
        zonas = riesgo_service.listar_zonas(nivel_riesgo=nivel, estado=estado)
        return jsonify({"ok": True, "data": zonas, "total": len(zonas)}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@rol_requerido("ADMINISTRADOR")
def crear_zona():
    """POST /api/zonas-riesgo - CU03: Registrar zona con poligono."""
    try:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"ok": False, "error": "Debe enviar los datos de la zona como un objeto JSON"}), 400
        payload.setdefault("id_administrador", g.usuario.id_persona)
        zona = riesgo_service.crear_zona(payload)
        return jsonify({"ok": True, "data": zona.to_dict(), "mensaje": "Zona creada correctamente"}), 201
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@rol_requerido("ADMINISTRADOR")
def actualizar_zona(id_zona):
    """PUT /api/zonas-riesgo/<id> - Modificar zona y poligono."""
    try:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"ok": False, "error": "Debe enviar los cambios como un objeto JSON"}), 400
        payload.setdefault("id_usuario", g.usuario.id_usuario)
        zona = riesgo_service.actualizar_zona(id_zona, payload)
        if not zona:
            return jsonify({"ok": False, "error": "Zona no encontrada"}), 404
        return jsonify({"ok": True, "data": zona.to_dict(), "mensaje": "Zona actualizada"}), 200
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@rol_requerido("ADMINISTRADOR")
def eliminar_zona(id_zona):
    """DELETE /api/zonas-riesgo/<id> - Eliminar zona y su historial asociado."""
    try:
        eliminada = riesgo_service.eliminar_zona(id_zona)
        if not eliminada:
            return jsonify({"ok": False, "error": "Zona no encontrada"}), 404
        return jsonify({"ok": True, "mensaje": "Zona eliminada correctamente"}), 200
    except Exception:
        from flask import current_app
        current_app.logger.exception("Error al eliminar zona")
        return jsonify({"ok": False, "error": "No se pudo eliminar la zona"}), 500


@rol_requerido("ADMINISTRADOR", "OPERADOR", "BOMBERO", "CIUDADANO")
def detalle_zona(id_zona):
    """GET /api/zonas-riesgo/<id> - Detalle de una zona."""
    try:
        zona = riesgo_service.obtener_zona(id_zona)
        if not zona:
            return jsonify({"ok": False, "error": "Zona no encontrada"}), 404
        return jsonify({"ok": True, "data": zona.to_dict()}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@rol_requerido("ADMINISTRADOR", "OPERADOR", "BOMBERO")
def listar_focos_calor():
    """GET /api/zonas-riesgo/focos-calor - CU09: Focos satelitales (24h)."""
    try:
        horas = int(request.args.get("horas", 24))
        focos = riesgo_service.listar_focos_calor(horas=horas)
        return jsonify({"ok": True, "data": focos, "total": len(focos)}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@rol_requerido("ADMINISTRADOR", "OPERADOR")
def emitir_alerta(id_zona):
    """POST /api/zonas-riesgo/<id>/alerta - CU10: Alerta preventiva COE."""
    try:
        payload = request.get_json(force=True) or {}
        payload.setdefault("emitido_por", g.usuario.id_usuario)
        alerta, error = riesgo_service.emitir_alerta_coe(id_zona, payload)
        if error:
            codigo = 404 if "no encontrada" in error else 400
            return jsonify({"ok": False, "error": error}), codigo
        return jsonify({"ok": True, "data": alerta.to_dict(), "mensaje": "Alerta preventiva emitida"}), 201
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@rol_requerido("ADMINISTRADOR", "OPERADOR", "BOMBERO", "CIUDADANO")
def resolver_ubicacion():
    """POST /api/zonas-riesgo/resolver-ubicacion - Extrae coordenadas GPS de un link de Google Maps o texto."""
    try:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"ok": False, "error": "Debe enviar la ubicación como un objeto JSON"}), 400
        texto = payload.get("ubicacion")
        if not isinstance(texto, str) or not texto.strip():
            return jsonify({"ok": False, "error": "Indique un enlace o coordenadas en el campo ubicación"}), 400
        texto = texto.strip()
        coords = riesgo_service.resolver_link_ubicacion(texto)
        if not coords:
            return jsonify({"ok": False, "error": "No se pudieron extraer coordenadas del enlace o texto"}), 400
        return jsonify({"ok": True, "data": coords}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@rol_requerido("ADMINISTRADOR", "OPERADOR", "BOMBERO", "CIUDADANO")
def focos_satelitales():
    """GET /api/zonas-riesgo/focos-satelitales - Focos de calor (NASA FIRMS) para el mapa general."""
    try:
        dias = max(1, min(int(request.args.get("days", 1)), 5))
        refrescar = request.args.get("refresh", "").lower() in ("1", "true", "si")
        return jsonify({"ok": True, "data": mapa_service.obtener_focos_satelitales(dias, refrescar)}), 200
    except ValueError:
        return jsonify({"ok": False, "error": "El parámetro 'days' debe ser un entero"}), 400
    except Exception:
        from flask import current_app
        current_app.logger.exception("Error al consultar focos satelitales")
        return jsonify({"ok": False, "error": "No se pudieron consultar los focos de calor"}), 500


@rol_requerido("ADMINISTRADOR", "OPERADOR", "BOMBERO", "CIUDADANO")
def areas_quemadas():
    """GET /api/zonas-riesgo/areas-quemadas - Historial de incendios y superficie quemada."""
    try:
        return jsonify({"ok": True, "data": mapa_service.obtener_areas_quemadas()}), 200
    except Exception:
        from flask import current_app
        current_app.logger.exception("Error al consultar áreas quemadas")
        return jsonify({"ok": False, "error": "No se pudieron consultar las áreas quemadas"}), 500


@rol_requerido("ADMINISTRADOR", "OPERADOR", "BOMBERO")
def superficie_quemada():
    """GET /api/zonas-riesgo/superficie-quemada - Tabla comparativa por departamento."""
    try:
        return jsonify({"ok": True, "data": riesgo_service.obtener_superficie_quemada()}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@rol_requerido("ADMINISTRADOR")
def cambiar_estado_zona(id_zona):
    """Activa o inactiva una zona y registra el historial."""

    payload = request.get_json(silent=True)

    if not isinstance(payload, dict):
        return jsonify({
            "ok": False,
            "error": "Debe enviar un objeto JSON valido"
        }), 400

    try:
        nuevo_estado = payload.get("estado")
        motivo = payload.get("motivo")

        zona, historial = riesgo_service.cambiar_estado_zona(
            id_zona=id_zona,
            nuevo_estado=nuevo_estado,
            motivo=motivo,
            id_usuario=g.usuario.id_usuario
        )

        return jsonify({
            "ok": True,
            "mensaje": "Estado actualizado correctamente",
            "data": zona.to_dict(),
            "historial": historial.to_dict()
        }), 200

    except ValueError as error:
        return jsonify({
            "ok": False,
            "error": str(error)
        }), 400

    except Exception:
        from flask import current_app
        current_app.logger.exception("Error al cambiar estado")
        return jsonify({
            "ok": False,
            "error": "Error interno del servidor"
        }), 500


@rol_requerido("ADMINISTRADOR")
def consultar_historial_zona(id_zona):
    """Devuelve el historial de estados de una zona."""

    try:
        historial = riesgo_service.obtener_historial_zona(id_zona)

        if historial is None:
            return jsonify({
                "ok": False,
                "error": "Zona no encontrada"
            }), 404

        return jsonify({
            "ok": True,
            "data": historial,
            "total": len(historial)
        }), 200

    except Exception:
        from flask import current_app
        current_app.logger.exception("Error al consultar historial")
        return jsonify({
            "ok": False,
            "error": "Error interno del servidor"
        }), 500
