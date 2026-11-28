"""
Datos para el mapa general de zonas de riesgo (visibles para todos los roles):
focos de calor satelitales (NASA FIRMS) y áreas quemadas (historial).
"""

from datetime import datetime, timedelta, timezone

from app.services import riesgo_service

# Sensores FIRMS agrupados con el nombre que se muestra en el mapa.
GRUPOS_SENSOR = {
    "VIIRS_SNPP_NRT": "NPP",
    "VIIRS_NOAA20_NRT": "NOAA20",
    "VIIRS_NOAA21_NRT": "NOAA21",
    "MODIS_NRT": "MODIS",
}

# Radio aproximado del área afectada según gravedad del incidente (metros).
RADIO_GRAVEDAD_M = {"BAJA": 300, "MEDIA": 700, "ALTA": 1500, "CATASTROFICA": 3000}


def obtener_focos_satelitales(days=1, refrescar=False):
    """Consulta los focos de calor de Bolivia en todos los sensores FIRMS y los unifica."""
    from app.services.firms_service import FirmsService

    servicio = FirmsService()
    focos = []
    por_sensor = {}
    estados = []
    mensajes = []

    for sensor, grupo in GRUPOS_SENSOR.items():
        resultado = servicio.consultar_focos(sensor=sensor, days=days, force_refresh=refrescar)
        estados.append(resultado["estado_fuente"])
        if resultado["estado_fuente"] not in ("en_vivo", "cache"):
            mensajes.append(resultado["mensaje"])
        por_sensor[grupo] = len(resultado["focos"])
        for foco in resultado["focos"]:
            focos.append(
                {
                    "id": foco["id_foco"],
                    "lat": foco["lat"],
                    "lng": foco["lng"],
                    "sensor": grupo,
                    "satelite": foco.get("satelite"),
                    "frp_mw": foco.get("frp_mw"),
                    "confianza": foco.get("confianza"),
                    "fecha_local": foco.get("fecha_hora_local"),
                    "departamento": foco.get("departamento"),
                }
            )

    if any(e in ("en_vivo", "cache") for e in estados):
        estado = "ok"
    elif all(e == "sin_clave" for e in estados):
        estado = "sin_clave"
    else:
        estado = "error"

    ahora = datetime.now(timezone.utc)
    return {
        "estado": estado,
        "mensaje": mensajes[0] if estado != "ok" and mensajes else "",
        "desde": (ahora - timedelta(days=days)).isoformat(),
        "hasta": ahora.isoformat(),
        "total": len(focos),
        "por_sensor": por_sensor,
        "focos": focos,
    }


def obtener_areas_quemadas():
    """Historial de incendios: incidentes anteriores con ubicación y superficie por departamento."""
    from app.models.incidente import Incidente
    from app.models.zona_riesgo import ZonaRiesgo
    from app.utils.geo_utils import extract_coordinates

    zonas = {z.id_zona: riesgo_service.centroide_coordenadas(z.coordenadas) for z in ZonaRiesgo.query.all()}
    incidentes = []
    for inc in Incidente.query.order_by(Incidente.fecha_inicio.desc()).limit(500).all():
        coords = extract_coordinates(inc.ubicacion)
        if coords:
            lat, lng = float(coords["lat"]), float(coords["lng"])
        elif inc.id_zona and zonas.get(inc.id_zona):
            lat, lng = zonas[inc.id_zona]
        else:
            continue
        incidentes.append(
            {
                "id": inc.id_incidente,
                "ubicacion": inc.ubicacion,
                "lat": lat,
                "lng": lng,
                "gravedad": inc.gravedad,
                "estado": inc.estado,
                "radio_m": RADIO_GRAVEDAD_M.get(inc.gravedad, 700),
                "fecha_inicio": inc.fecha_inicio.isoformat() if inc.fecha_inicio else None,
                "fecha_cierre": inc.fecha_cierre.isoformat() if inc.fecha_cierre else None,
                "anio": inc.fecha_inicio.year if inc.fecha_inicio else None,
            }
        )

    return {
        "incidentes": incidentes,
        "superficie": riesgo_service.obtener_superficie_quemada(),
    }
