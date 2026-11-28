import json

from app.config.database import db
from app.models.inspeccion import Inspeccion
from app.models.zona_riesgo import ZonaRiesgo

NIVELES = {"BAJO", "MEDIO", "ALTO", "EXTREMO"}
ACCESIBILIDADES = {"Fácil", "Media", "Difícil"}


def _serializar_evidencia(data):
    materiales = [str(m).strip() for m in (data.get("material_combustible") or []) if str(m).strip()]
    accesibilidad = (data.get("accesibilidad") or "").strip() or None
    if accesibilidad and accesibilidad not in ACCESIBILIDADES:
        raise ValueError("Accesibilidad no válida")
    fotos = [str(f) for f in (data.get("fotos") or []) if isinstance(f, str) and f.strip()][:5]
    if materiales or accesibilidad or fotos:
        return json.dumps(
            {"materiales": materiales, "accesibilidad": accesibilidad, "fotos": fotos},
            ensure_ascii=False,
        )
    return data.get("evidencia")


def registrar_inspeccion(id_inspector, data):
    if not isinstance(data, dict):
        raise ValueError("La inspección debe enviarse como un objeto JSON")
    zona = db.session.get(ZonaRiesgo, data.get("id_zona"))
    if zona is None:
        raise ValueError("La zona no existe")
    nivel = (data.get("nivel_riesgo_observado") or "").upper()
    if nivel not in NIVELES:
        raise ValueError("Nivel de riesgo no válido")
    observaciones = str(data.get("observaciones") or "").strip()
    if not observaciones:
        raise ValueError("Las observaciones son obligatorias")
    inspeccion = Inspeccion(
        id_zona=zona.id_zona,
        id_inspector=id_inspector,
        nivel_riesgo_observado=nivel,
        observaciones=observaciones,
        recomendaciones=(data.get("recomendaciones") or "").strip() or None,
        evidencia=_serializar_evidencia(data),
    )
    db.session.add(inspeccion)
    db.session.commit()
    return inspeccion


def listar_por_zona(id_zona):
    return Inspeccion.query.filter_by(id_zona=id_zona).order_by(Inspeccion.fecha_inspeccion.desc()).all()


def listar_todas(id_zona=None, nivel=None):
    query = Inspeccion.query
    if id_zona is not None:
        query = query.filter_by(id_zona=id_zona)
    if nivel:
        query = query.filter_by(nivel_riesgo_observado=nivel.upper())
    return query.order_by(Inspeccion.fecha_inspeccion.desc()).all()
