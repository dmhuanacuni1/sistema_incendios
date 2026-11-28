from datetime import datetime, timezone

from app.config.database import db
from app.models.solicitud_zona import SolicitudZona
from app.models.zona_riesgo import ZonaRiesgo
from app.services.riesgo_service import (
    DISTANCIA_DUPLICADO_KM,
    distancia_km,
    normalizar_texto,
    validar_zona_duplicada,
)

NIVELES = {"BAJO", "MEDIO", "ALTO", "EXTREMO"}


def _validar_solicitud_duplicada(nombre, lat, lng):
    """Evita enviar dos solicitudes pendientes con el mismo nombre o en el mismo lugar."""
    nombre_norm = normalizar_texto(nombre)
    for pendiente in SolicitudZona.query.filter_by(estado="PENDIENTE").all():
        if normalizar_texto(pendiente.nombre) == nombre_norm:
            raise ValueError(f"Ya existe una solicitud pendiente con el nombre «{pendiente.nombre}»")
        if pendiente.latitud is not None and pendiente.longitud is not None:
            if distancia_km((lat, lng), (float(pendiente.latitud), float(pendiente.longitud))) <= DISTANCIA_DUPLICADO_KM:
                raise ValueError(
                    f"Ya existe una solicitud pendiente («{pendiente.nombre}») en esta misma ubicación"
                )


def crear_solicitud(id_ciudadano, data):
    if not isinstance(data, dict):
        raise ValueError("La solicitud debe enviarse como un objeto JSON")
    for campo in ("nombre", "descripcion", "ubicacion"):
        if not str(data.get(campo) or "").strip():
            raise ValueError(f"El campo '{campo}' es obligatorio")
    nivel = (data.get("nivel_riesgo_sugerido") or "").upper() or None
    if nivel and nivel not in NIVELES:
        raise ValueError("Nivel de riesgo no válido")
    try:
        lat = float(data["latitud"]) if data.get("latitud") not in (None, "") else None
        lng = float(data["longitud"]) if data.get("longitud") not in (None, "") else None
    except (TypeError, ValueError):
        raise ValueError("Coordenadas no válidas")
    if lat is None or lng is None:
        raise ValueError("La solicitud necesita latitud y longitud GPS para registrar la zona")
    if lat is not None and not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise ValueError("Coordenadas fuera de rango")
    validar_zona_duplicada(data["nombre"], [{"lat": lat, "lng": lng}])
    _validar_solicitud_duplicada(data["nombre"], lat, lng)
    solicitud = SolicitudZona(
        id_ciudadano=id_ciudadano,
        nombre=data["nombre"].strip()[:100],
        descripcion=data["descripcion"].strip(),
        ubicacion=data["ubicacion"].strip(),
        coordenadas=([{"lat": lat, "lng": lng}] if lat is not None else []),
        tipo_vegetacion=(data.get("tipo_vegetacion") or "Sin especificar").strip()[:80],
        area_hectareas=data.get("area_hectareas") or 0,
        temperatura=data.get("temperatura") or 25,
        humedad=data.get("humedad") or 40,
        velocidad_viento=data.get("velocidad_viento") or 15,
        latitud=lat,
        longitud=lng,
        nivel_riesgo_sugerido=nivel,
        evidencia=data.get("evidencia"),
    )
    db.session.add(solicitud)
    db.session.commit()
    return solicitud


def listar_solicitudes(id_ciudadano=None, pendientes=False, estado=None):
    query = SolicitudZona.query
    if id_ciudadano is not None:
        query = query.filter_by(id_ciudadano=id_ciudadano)
    if pendientes:
        query = query.filter_by(estado="PENDIENTE")
    elif estado:
        query = query.filter_by(estado=estado.upper())
    return query.order_by(SolicitudZona.fecha_solicitud.desc()).all()


def evaluar_solicitud(id_solicitud, id_evaluador, estado, observacion="", nivel_riesgo_final=None):
    estado = (estado or "").upper()
    if estado not in {"APROBADA", "RECHAZADA"}:
        raise ValueError("La evaluación debe ser APROBADA o RECHAZADA")
    solicitud = db.session.get(SolicitudZona, id_solicitud)
    if solicitud is None:
        return None
    if solicitud.estado != "PENDIENTE":
        raise ValueError("Esta solicitud ya fue evaluada")
    if estado == "RECHAZADA" and not str(observacion).strip():
        raise ValueError("Indica el motivo de la denegación en Observaciones")

    nivel_final = (nivel_riesgo_final or "").strip().upper() or (solicitud.nivel_riesgo_sugerido or "MEDIO")
    if nivel_final not in NIVELES:
        raise ValueError("Nivel de riesgo final no válido")

    try:
        if estado == "APROBADA":
            coordenadas = list(solicitud.coordenadas or [])
            if not coordenadas and solicitud.latitud is not None and solicitud.longitud is not None:
                coordenadas = [{"lat": float(solicitud.latitud), "lng": float(solicitud.longitud)}]
            validar_zona_duplicada(solicitud.nombre, coordenadas)
            zona = ZonaRiesgo(
                nombre=solicitud.nombre[:100],
                descripcion=solicitud.descripcion,
                ubicacion=solicitud.ubicacion,
                nivel_riesgo=nivel_final,
                tipo_vegetacion=solicitud.tipo_vegetacion or "Pastizal seco",
                temperatura=solicitud.temperatura if solicitud.temperatura is not None else 25.0,
                humedad=solicitud.humedad if solicitud.humedad is not None else 40.0,
                velocidad_viento=solicitud.velocidad_viento if solicitud.velocidad_viento is not None else 15.0,
                id_administrador=id_evaluador,
                coordenadas=coordenadas,
            )
            db.session.add(zona)
            db.session.flush()
            solicitud.id_zona = zona.id_zona
        solicitud.estado = estado
        solicitud.id_evaluador = id_evaluador
        solicitud.observacion_admin = (observacion or "").strip() or None
        solicitud.fecha_evaluacion = datetime.now(timezone.utc)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return solicitud


def eliminar_solicitud(id_solicitud):
    solicitud = db.session.get(SolicitudZona, id_solicitud)
    if solicitud is None:
        return False
    db.session.delete(solicitud)
    db.session.commit()
    return True
