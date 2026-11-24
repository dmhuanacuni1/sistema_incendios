"""Controlador HTTP para incidentes y sus subrecursos (SRP / ISP / DIP)."""

from flask import g, request

from app.middleware.error_handler import ValidationError
from app.services.despacho_brigada_service import DespachoBrigadaService
from app.services.evaluacion_dano_service import EvaluacionDanoService
from app.services.firms_service import FirmsService
from app.services.incidente_service import IncidenteService
from app.services.informe_bombero_service import InformeBomberoService
from app.services.referencias_service import (
    ReferenciaValidatorProtocol,
    SQLAlchemyReferenciaValidator,
)
from app.utils.validators import require_non_empty_str
from app.views.incidentes_view import (
    serialize_evaluacion_dano,
    serialize_incidente,
    serialize_incidente_brigada,
    serialize_informe_bombero,
)
from app.views.response_view import success_response


class IncidentesController:
    """Orquesta las peticiones HTTP del recurso /api/incidentes."""

    def __init__(
        self,
        incidente_service: IncidenteService | None = None,
        despacho_service: DespachoBrigadaService | None = None,
        informe_service: InformeBomberoService | None = None,
        evaluacion_service: EvaluacionDanoService | None = None,
        referencias_service: ReferenciaValidatorProtocol | None = None,
        firms_service: FirmsService | None = None,
    ) -> None:
        self._incidentes = incidente_service or IncidenteService()
        self._despacho = despacho_service or DespachoBrigadaService()
        self._informes = informe_service or InformeBomberoService()
        self._evaluaciones = evaluacion_service or EvaluacionDanoService()
        self._referencias = referencias_service or SQLAlchemyReferenciaValidator()
        self._firms = firms_service or FirmsService()

    def listar(self):
        estado = request.args.get("estado")
        gravedad = request.args.get("gravedad")
        q = request.args.get("q")
        id_zona_raw = request.args.get("id_zona")
        id_zona: int | None = None
        if id_zona_raw is not None:
            try:
                id_zona = int(id_zona_raw)
            except ValueError as exc:
                raise ValidationError("El parámetro 'id_zona' debe ser entero") from exc

        incidentes = self._incidentes.listar_incidentes(
            estado=estado, gravedad=gravedad, id_zona=id_zona, q=q
        )
        return success_response(
            data=[serialize_incidente(i) for i in incidentes],
            message="Listado de incidentes",
        )

    def obtener(self, id_incidente: int):
        incidente = self._incidentes.obtener_incidente(id_incidente)
        return success_response(
            data=serialize_incidente(incidente),
            message="Incidente encontrado",
        )

    def crear(self):
        payload = dict(request.get_json(silent=True) or {})
        usuario = getattr(g, "usuario", None)
        if usuario is not None and payload.get("id_operador") is None:
            payload["id_operador"] = usuario.id_persona
        incidente = self._incidentes.crear_incidente(payload)
        return success_response(
            data=serialize_incidente(incidente),
            message="Incidente creado",
            status_code=201,
        )

    def cambiar_estado(self, id_incidente: int):
        payload = request.get_json(silent=True) or {}
        nuevo_estado = require_non_empty_str(payload, "estado")
        incidente = self._incidentes.cambiar_estado(id_incidente, nuevo_estado)
        return success_response(
            data=serialize_incidente(incidente),
            message="Estado del incidente actualizado",
        )

    def actualizar(self, id_incidente: int):
        payload = request.get_json(silent=True) or {}
        incidente = self._incidentes.actualizar_incidente(id_incidente, payload)
        return success_response(
            data=serialize_incidente(incidente),
            message="Incidente actualizado",
        )

    def cerrar(self, id_incidente: int):
        incidente = self._incidentes.cambiar_estado(id_incidente, "CERRADO")
        return success_response(
            data=serialize_incidente(incidente),
            message="Incidente cerrado correctamente",
        )

    def referencias(self):
        return success_response(
            data=self._referencias.listar_catalogos(),
            message="Catálogos de referencia para incidentes",
        )

    def resumen_operativo(self):
        return success_response(
            data=self._incidentes.obtener_resumen_operativo(),
            message="Resumen operativo del módulo de incidentes",
        )

    def satelite_firms(self):
        sensor = request.args.get("sensor")
        bbox_raw = request.args.get("bbox")
        days_raw = request.args.get("days", "1")
        try:
            days = int(days_raw)
        except ValueError as exc:
            raise ValidationError("El parámetro 'days' debe ser entero") from exc

        simulado = request.args.get("simulado", "").strip().lower() in ("1", "true", "si")
        force_refresh = request.args.get("refresh", "").strip().lower() in ("1", "true", "si")

        resultado = self._firms.consultar_focos(
            sensor=sensor,
            days=days,
            bbox_raw=bbox_raw,
            simulado=simulado,
            force_refresh=force_refresh,
        )
        return success_response(
            data=resultado,
            message="Anomalías térmicas satelitales NASA FIRMS",
        )

    def expediente(self, id_incidente: int):
        return success_response(
            data=self._incidentes.obtener_expediente(id_incidente),
            message="Expediente completo del incidente",
        )

    # --- Subrecurso: Brigadas asignadas ---

    def listar_brigadas(self, id_incidente: int):
        asignaciones = self._despacho.listar_por_incidente(id_incidente)
        return success_response(
            data=[serialize_incidente_brigada(a) for a in asignaciones],
            message="Brigadas asignadas al incidente",
        )

    def despacho_sugerido(self, id_incidente: int):
        sugerencia = self._despacho.sugerir_despacho(id_incidente)
        return success_response(
            data=sugerencia,
            message="Sugerencia de despacho por cercanía y disponibilidad",
        )

    def asignar_brigada(self, id_incidente: int):
        payload = request.get_json(silent=True) or {}
        asignacion = self._despacho.asignar_brigada(id_incidente, payload)
        return success_response(
            data=serialize_incidente_brigada(asignacion),
            message="Brigada asignada al incidente",
            status_code=201,
        )

    def cambiar_estado_brigada(self, id_incidente: int, id_brigada: int):
        payload = request.get_json(silent=True) or {}
        nuevo_estado = require_non_empty_str(payload, "estado_asignacion")
        asignacion = self._despacho.cambiar_estado_asignacion(
            id_incidente, id_brigada, nuevo_estado
        )
        return success_response(
            data=serialize_incidente_brigada(asignacion),
            message="Estado de asignación actualizado",
        )

    # --- Subrecurso: Informes de bombero ---

    def listar_informes(self, id_incidente: int):
        informes = self._informes.listar_por_incidente(id_incidente)
        return success_response(
            data=[serialize_informe_bombero(inf) for inf in informes],
            message="Informes de bombero del incidente",
        )

    def crear_informe(self, id_incidente: int):
        payload = dict(request.get_json(silent=True) or {})
        usuario = getattr(g, "usuario", None)
        if usuario is not None:
            rol_nombre = getattr(getattr(usuario, "rol", None), "nombre_rol", None)
            if rol_nombre == "BOMBERO" or payload.get("id_bombero") is None:
                payload["id_bombero"] = usuario.id_persona
        informe = self._informes.crear_informe(id_incidente, payload)
        return success_response(
            data=serialize_informe_bombero(informe),
            message="Informe de bombero registrado",
            status_code=201,
        )

    # --- Subrecurso: Evaluación de daños ---

    def obtener_evaluacion(self, id_incidente: int):
        evaluacion = self._evaluaciones.obtener_por_incidente(id_incidente)
        return success_response(
            data=serialize_evaluacion_dano(evaluacion),
            message="Evaluación de daños encontrada",
        )

    def crear_evaluacion(self, id_incidente: int):
        payload = request.get_json(silent=True) or {}
        evaluacion = self._evaluaciones.crear_evaluacion(id_incidente, payload)
        return success_response(
            data=serialize_evaluacion_dano(evaluacion),
            message="Evaluación de daños registrada",
            status_code=201,
        )

    def actualizar_evaluacion(self, id_incidente: int):
        payload = request.get_json(silent=True) or {}
        evaluacion = self._evaluaciones.actualizar_evaluacion(id_incidente, payload)
        return success_response(
            data=serialize_evaluacion_dano(evaluacion),
            message="Evaluación de daños actualizada",
        )
