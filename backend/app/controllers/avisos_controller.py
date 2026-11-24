"""Controlador HTTP para avisos de incendio (SRP / DIP)."""

from flask import g, request

from app.middleware.auth import _usuario_desde_token
from app.middleware.error_handler import ValidationError
from app.services.aviso_service import AvisoService
from app.utils.geo_utils import validate_coordinates
from app.utils.validators import require_non_empty_str
from app.views.incidentes_view import serialize_aviso
from app.views.response_view import success_response

# IMPORTACIONES NUEVAS
from app.services.alertas_service import AlertasService
from app.services.incidente_service import IncidenteService


class AvisosController:
    """Orquesta las peticiones HTTP del recurso /api/avisos."""

    def __init__(
        self, 
        service: AvisoService | None = None,
        alertas_service: AlertasService | None = None
    ) -> None:
        self._service = service or AvisoService()
        self._alertas = alertas_service or AlertasService()

    def listar(self):
        estado = request.args.get("estado_aviso")
        nivel = request.args.get("nivel_urgencia")
        q = request.args.get("q")
        avisos = self._service.listar_avisos(
            estado_aviso=estado, nivel_urgencia=nivel, q=q
        )
        return success_response(
            data=[serialize_aviso(a) for a in avisos],
            message="Listado de avisos de incendio",
        )

    def mis_avisos(self):
        usuario = getattr(g, "usuario", None)
        if usuario is not None:
            id_ciudadano = usuario.id_persona
        else:
            id_ciudadano = request.args.get("id_ciudadano", type=int)
            if id_ciudadano is None:
                raise ValidationError("No se pudo identificar al ciudadano autenticado")
        avisos = self._service.listar_por_ciudadano(id_ciudadano)
        return success_response(
            data=[serialize_aviso(a) for a in avisos],
            message="Historial de avisos del ciudadano",
        )

    def obtener(self, id_aviso: int):
        aviso = self._service.obtener_aviso(id_aviso)
        return success_response(
            data=serialize_aviso(aviso),
            message="Aviso de incendio encontrado",
        )

    def crear(self):
        payload = dict(request.get_json(silent=True) or {})
        if (
            payload.get("id_ciudadano") is None
            and request.headers.get("Authorization", "").startswith("Bearer ")
        ):
            usuario, error = _usuario_desde_token("access")
            if (
                error is None
                and usuario is not None
                and usuario.rol is not None
                and usuario.rol.nombre_rol == "CIUDADANO"
            ):
                payload["id_ciudadano"] = usuario.id_persona

        aviso = self._service.crear_aviso(payload)
        
        # INTEGRACIÓN CON ALERTAS
        try:
            self._alertas.notificar_aviso_ciudadano(aviso)
            self._alertas.notificar_aviso_operadores(aviso)
        except Exception as e:
            print(f"Error en alertas al crear aviso: {e}")

        return success_response(
            data=serialize_aviso(aviso),
            message="Aviso de incendio registrado",
            status_code=201,
        )

    def cambiar_estado(self, id_aviso: int):
        payload = request.get_json(silent=True) or {}
        nuevo_estado = require_non_empty_str(payload, "estado_aviso")
        motivo = payload.get("motivo")
        aviso = self._service.cambiar_estado(id_aviso, nuevo_estado, motivo=motivo)
        
        # INTEGRACIÓN CON ALERTAS
        try:
            if nuevo_estado == "VERIFICADO":
                self._alertas.notificar_aviso_verificado(aviso)
            elif nuevo_estado == "DESCARTADO":
                # NUEVO: Notificar al ciudadano que su aviso fue descartado
                self._alertas.notificar_aviso_descartado(aviso, motivo)
        except Exception as e:
            print(f"Error en alertas al cambiar estado de aviso: {e}")
        
        return success_response(
            data=serialize_aviso(aviso),
            message="Estado del aviso actualizado",
        )

    def enviar_descripcion(self, id_aviso: int):
        payload = request.get_json(silent=True) or {}
        descripcion = payload.get("descripcion")
        foto = payload.get("foto")
        if (
            not (isinstance(descripcion, str) and descripcion.strip())
            and not (isinstance(foto, str) and foto.strip())
        ):
            raise ValidationError(
                "Debes enviar al menos una descripción o una fotografía"
            )
        nivel_urgencia = payload.get("nivel_urgencia")
        append = bool(payload.get("append", True))
        aviso = self._service.actualizar_descripcion(
            id_aviso=id_aviso,
            descripcion=descripcion,
            nivel_urgencia=nivel_urgencia,
            append=append,
            foto=foto,
        )
        return success_response(
            data=serialize_aviso(aviso),
            message="Evidencia/descripción del incendio actualizada",
        )

    def cercanos(self):
        lat_raw = request.args.get("lat")
        lng_raw = request.args.get("lng")
        if lat_raw is None or lng_raw is None:
            raise ValidationError("Los parámetros 'lat' y 'lng' son obligatorios")
        lat, lng = validate_coordinates(lat_raw, lng_raw)

        radio_raw = request.args.get("radio_km", "3.0")
        try:
            radio_km = float(radio_raw)
        except ValueError as exc:
            raise ValidationError("El parámetro 'radio_km' debe ser numérico") from exc
        if radio_km <= 0:
            raise ValidationError("El parámetro 'radio_km' debe ser mayor a 0")

        cercanos = self._service.detectar_cercanos(lat=lat, lng=lng, radio_km=radio_km)
        return success_response(
            data=cercanos,
            message="Avisos cercanos detectados",
        )

    def agrupados(self):
        radio_raw = request.args.get("radio_km", "2.5")
        min_raw = request.args.get("min_avisos", "2")
        try:
            radio_km = float(radio_raw)
            min_avisos = int(min_raw)
        except ValueError as exc:
            raise ValidationError(
                "Los parámetros 'radio_km' y 'min_avisos' deben ser numéricos"
            ) from exc
        if radio_km <= 0 or min_avisos < 1:
            raise ValidationError("Parámetros de agrupación fuera de rango")

        grupos = self._service.agrupar_y_triangular(
            radio_km=radio_km, min_avisos=min_avisos
        )
        return success_response(
            data=grupos,
            message="Grupos de alarmas triangulados por proximidad",
        )

    def consolidar_grupo(self):
        payload = dict(request.get_json(silent=True) or {})
        usuario = getattr(g, "usuario", None)
        if usuario is not None and payload.get("id_operador") is None:
            payload["id_operador"] = usuario.id_persona
            
        resultado = self._service.consolidar_grupo_en_incidente(payload)
        
        # INTEGRACIÓN CON ALERTAS
        try:
            id_incidente = resultado["incidente"]["id_incidente"]
            inc_svc = IncidenteService()
            incidente_db = inc_svc.obtener_incidente(id_incidente)
            self._alertas.generar_alerta_nuevo_incidente(incidente_db)
        except Exception as e:
            print(f"Error en alertas al consolidar grupo: {e}")

        return success_response(
            data=resultado,
            message="Grupo de alarmas consolidado en un único incidente",
            status_code=201,
        )