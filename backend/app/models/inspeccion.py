import json
from datetime import datetime, timezone

from app.config.database import db


def _parsear_evidencia(raw):
    """Extrae metadatos estructurados de `evidencia` sin romper textos planos previos."""
    if not raw:
        return {"material_combustible": [], "accesibilidad": None, "fotos": []}
    if isinstance(raw, str) and raw.lstrip().startswith("{"):
        try:
            obj = json.loads(raw)
            if isinstance(obj, dict):
                return {
                    "material_combustible": obj.get("materiales") or [],
                    "accesibilidad": obj.get("accesibilidad") or None,
                    "fotos": obj.get("fotos") or [],
                }
        except ValueError:
            pass
    return {"material_combustible": [], "accesibilidad": None, "fotos": [raw]}


class Inspeccion(db.Model):
    __tablename__ = "inspecciones"

    id_inspeccion = db.Column(db.Integer, primary_key=True)
    id_zona = db.Column(db.Integer, db.ForeignKey("zonas_riesgo.id_zona", ondelete="CASCADE"), nullable=False)
    id_inspector = db.Column(db.Integer, db.ForeignKey("personas.id_persona", ondelete="RESTRICT"), nullable=False)
    fecha_inspeccion = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    nivel_riesgo_observado = db.Column(db.String(20), nullable=False)
    observaciones = db.Column(db.Text, nullable=False)
    recomendaciones = db.Column(db.Text)
    evidencia = db.Column(db.Text)

    inspector = db.relationship("Persona", lazy="joined")
    zona = db.relationship("ZonaRiesgo", lazy="joined")

    def to_dict(self):
        extra = _parsear_evidencia(self.evidencia)
        nombre_inspector = (
            f"{self.inspector.nombres} {self.inspector.apellidos}".strip()
            if self.inspector
            else f"Inspector #{self.id_inspector}"
        )
        return {
            "id_inspeccion": self.id_inspeccion,
            "id_zona": self.id_zona,
            "zona_nombre": self.zona.nombre if self.zona else f"Zona #{self.id_zona}",
            "zona_ubicacion": self.zona.ubicacion if self.zona else "",
            "id_inspector": self.id_inspector,
            "inspector_nombre": nombre_inspector,
            "fecha_inspeccion": self.fecha_inspeccion.isoformat() if self.fecha_inspeccion else None,
            "nivel_riesgo_observado": self.nivel_riesgo_observado,
            "observaciones": self.observaciones,
            "recomendaciones": self.recomendaciones,
            "evidencia": self.evidencia,
            "material_combustible": extra["material_combustible"],
            "accesibilidad": extra["accesibilidad"],
            "fotos": extra["fotos"],
        }
