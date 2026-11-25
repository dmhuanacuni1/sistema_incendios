"""Controladores de caso de uso: estaciones y consulta de infraestructura."""

from flask import Response, g, jsonify, request

from app.services import estaciones_service
from app.services.estaciones_service import ErrorModulo
from app.views.recursos_view import estacion_a_dict


def _datos():
    datos = request.get_json(silent=True)
    return datos if isinstance(datos, dict) else {}


def _error(exc):
    return jsonify({"error": exc.mensaje, "campo": exc.campo}), exc.codigo


def ctrlListarEstaciones():
    return jsonify(
        [estacion_a_dict(estacion) for estacion in estaciones_service.listar_estaciones()]
    )


def ctrlObtenerFotoEstacion(id_estacion):
    """Sirve la foto de una estación sin exponerla en los listados."""
    try:
        contenido, mimetype = estaciones_service.obtener_foto(id_estacion)
    except ErrorModulo as exc:
        return _error(exc)
    return Response(
        contenido,
        mimetype=mimetype,
        # La foto se reemplaza desde el modal: evitar que el navegador sirva una copia vieja.
        headers={"Cache-Control": "no-store"},
    )


def ctrlCURegistrarEstacion():
    """CU-01: alta de estación; el administrador se toma del token."""
    try:
        estacion = estaciones_service.crear_estacion(_datos(), g.usuario)
    except ErrorModulo as exc:
        return _error(exc)
    return (
        jsonify(
            {
                "mensaje": "Estación registrada correctamente",
                "estacion": estacion_a_dict(estacion),
            }
        ),
        201,
    )


def ctrlActualizarEstacion(id_estacion):
    """Edita datos, foto y/o estado (baja lógica) de una estación."""
    try:
        estacion = estaciones_service.actualizar_estacion(id_estacion, _datos())
    except ErrorModulo as exc:
        return _error(exc)
    mensaje = (
        "Estación dada de baja. La ficha se conserva en el sistema."
        if estacion.estado == "DE_BAJA"
        else "Estación actualizada correctamente"
    )
    return jsonify(
        {"mensaje": mensaje, "estacion": estacion_a_dict(estacion)}
    )


def ctrlCUConsultar():
    """CU-04: estaciones con unidades y recursos; filtro ?estado=Disponible."""
    try:
        datos = estaciones_service.consultar(request.args.get("estado"))
    except ErrorModulo as exc:
        return _error(exc)
    return jsonify(datos)
