"""Controlador HTTP del modulo de informes."""

from io import BytesIO

from flask import g, request, send_file, abort

from app.middleware.error_handler import ValidationError
from app.views.response_view import success_response

from app.services.informes_service import (
    generar_informe,
    listar_informes,
    obtener_detalle_informe,
    obtener_archivo_informe,
    obtener_contenido_excel,
    generar_informe_estructurado,
    exportar_informe_estructurado,
)


class InformesController:
    """Gestiona las solicitudes HTTP de informes."""

    def generar(self, estructurado=False):

        # Obtener datos de la solicitud
        datos = request.get_json(silent=True)

        if not isinstance(datos, dict):
            raise ValidationError(
                "Debe proporcionar un objeto JSON valido"
            )

        tipo_reporte = datos.get(
            "tipo_reporte", "GENERAL"
        )

        formato = datos.get("formato", "PDF")

        fecha_inicio = datos.get("fecha_inicio")
        fecha_fin = datos.get("fecha_fin")
        nivel_riesgo = datos.get("nivel_riesgo")
        id_zona = datos.get("id_zona")
        id_solicitud = datos.get("id_solicitud")

        # Validar identificador de solicitud
        if estructurado:

            if (
                not isinstance(id_solicitud, str)
                or not id_solicitud.strip()
            ):
                raise ValidationError(
                    "Debe proporcionar un identificador de solicitud valido"
                )

            id_solicitud = id_solicitud.strip()

        # Validar tipo y formato
        if not isinstance(tipo_reporte, str):
            raise ValidationError(
                "El tipo de informe debe ser texto"
            )

        if not isinstance(formato, str):
            raise ValidationError(
                "El formato debe ser texto"
            )

        # Validar filtros de texto
        filtros_texto = {
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "nivel_riesgo": nivel_riesgo,
        }

        for campo, valor in filtros_texto.items():
            if valor is not None and not isinstance(valor, str):
                raise ValidationError(
                    f"El parametro {campo} debe ser texto"
                )

        fecha_inicio = fecha_inicio or None
        fecha_fin = fecha_fin or None
        nivel_riesgo = nivel_riesgo or None

        # Validar identificador de zona
        if id_zona == "":
            id_zona = None

        if id_zona is not None:

            if isinstance(id_zona, bool) or not isinstance(
                id_zona, (int, str)
            ):
                raise ValidationError(
                    "El parametro id_zona debe ser entero"
                )

            try:
                id_zona = int(id_zona)

            except ValueError as exc:
                raise ValidationError(
                    "El parametro id_zona debe ser entero"
                ) from exc

            if id_zona <= 0:
                raise ValidationError(
                    "El identificador de zona debe ser positivo"
                )

        # Obtener administrador autenticado
        id_administrador = g.usuario.id_persona

        # Generar y almacenar el informe
        try:
            if estructurado:
                resultado = generar_informe_estructurado(
                id_administrador=id_administrador,
                tipo_reporte=tipo_reporte,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                id_zona=id_zona,
                nivel_riesgo=nivel_riesgo,
                id_solicitud=id_solicitud,
            )

            else:
                resultado = generar_informe(
                    id_administrador=id_administrador,
                    tipo_reporte=tipo_reporte,
                    formato=formato,
                    fecha_inicio=fecha_inicio,
                    fecha_fin=fecha_fin,
                    id_zona=id_zona,
                    nivel_riesgo=nivel_riesgo,
                )

        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

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

    def listar(self):
        """Consulta el historial de informes."""

        resultado = listar_informes()

        mensaje = (
            "Historial obtenido correctamente"
            if resultado
            else "No existen informes registrados"
        )

        return success_response(
            data=resultado,
            message=mensaje,
            status_code=200,
        )

    def detalle(self, id_reporte):
        """Consulta el detalle de un informe."""

        resultado = obtener_detalle_informe(
            id_reporte
        )

        if resultado is None:
            abort(
                404,
                description="Informe no encontrado",
            )

        return success_response(
            data=resultado,
            message="Detalle obtenido correctamente",
            status_code=200,
        )

    def descargar(self, id_reporte):
        """Descarga el archivo original del informe."""

        archivo = obtener_archivo_informe(
            id_reporte
        )

        if archivo is None:
            abort(
                404,
                description="Archivo no encontrado",
            )

        respuesta = send_file(
            BytesIO(archivo["contenido"]),
            mimetype=archivo["tipo_mime"],
            as_attachment=True,
            download_name=archivo["nombre_archivo"],
            conditional=False,
            max_age=0,
        )

        respuesta.headers["Cache-Control"] = (
            "private, no-store"
        )

        return respuesta

    def contenido(self, id_reporte):
        """Consulta el contenido del informe Excel."""

        try:
            resultado = obtener_contenido_excel(
                id_reporte
            )

        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        if resultado is None:
            abort(
                404,
                description="Archivo no encontrado",
            )

        return success_response(
            data=resultado,
            message="Contenido obtenido correctamente",
            status_code=200,
        )
    def exportar(self, id_reporte):
        """Exporta un informe en el formato solicitado."""

        formato = request.args.get("formato", "PDF")

        try:
            archivo = exportar_informe_estructurado(
                id_reporte,
                formato,
            )

        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        if archivo is None:
            abort(
                404,
                description="Informe o archivo no encontrado",
            )

        respuesta = send_file(
            BytesIO(archivo["contenido"]),
            mimetype=archivo["tipo_mime"],
            as_attachment=True,
            download_name=archivo["nombre_archivo"],
            conditional=False,
            max_age=0,
        )

        respuesta.headers["Cache-Control"] = (
            "private, no-store"
        )

        return respuesta