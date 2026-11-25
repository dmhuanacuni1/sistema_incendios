
"""Controlador HTTP del modulo de estadisticas e informes."""

from flask import request

from app.middleware.error_handler import ValidationError
from app.services.estadisticas_service import obtener_estadisticas
from app.views.response_view import success_response


class EstadisticasController:
    """Gestiona las solicitudes HTTP de estadisticas."""

    def __init__(self, estadisticas_service=None):
        self._estadisticas = (
            estadisticas_service or obtener_estadisticas
        )

    def consultar(self):

        # Obtener filtros de la solicitud HTTP
        fecha_inicio = request.args.get("fecha_inicio")
        fecha_fin = request.args.get("fecha_fin")
        nivel_riesgo = request.args.get("nivel_riesgo")
        id_zona_raw = request.args.get("id_zona")

        id_zona = None

        # Validar identificador de zona
        if id_zona_raw is not None:
            try:
                id_zona = int(id_zona_raw)
            except ValueError as exc:
                raise ValidationError(
                    "El parametro id_zona debe ser entero"
                ) from exc

            if id_zona <= 0:
                raise ValidationError(
                    "El identificador de zona debe ser positivo"
                )

        # Consultar el servicio de estadisticas
        try:
            resultado = self._estadisticas(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                id_zona=id_zona,
                nivel_riesgo=nivel_riesgo
            )

        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        # Determinar mensaje de respuesta
        if resultado["sin_datos"]:
            mensaje = (
                "No se encontraron incidentes "
                "para los filtros seleccionados"
            )
        else:
            mensaje = "Estadisticas obtenidas correctamente"

        # Respuesta JSON estandarizada
        solicitud_reutilizada = resultado.get(
            "solicitud_reutilizada",
            False,
        )

        mensaje = (
            "Informe existente recuperado correctamente"
            if solicitud_reutilizada
            else "Informe generado correctamente"
        )

        codigo_estado = (
            200 if solicitud_reutilizada else 201
        )

        return success_response(
        data=resultado,
        message=mensaje,
        status_code=codigo_estado,
    )
