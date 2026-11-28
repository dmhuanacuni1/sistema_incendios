from datetime import datetime, timezone

from app.config.database import db


class SolicitudZona(db.Model):
    """Solicitud mapeada a la estructura histórica ya presente en Neon."""

    __tablename__ = "solicitudes_zona_riesgo"

    id_solicitud = db.Column(db.Integer, primary_key=True)
    # La tabla existente usa id_solicitante; en los controladores representa al ciudadano.
    id_ciudadano = db.Column("id_solicitante", db.Integer, db.ForeignKey("personas.id_persona", ondelete="CASCADE"), nullable=False)
    nombre = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text, nullable=False)
    ubicacion = db.Column(db.Text, nullable=False)
    coordenadas = db.Column(db.JSON, default=list)
    tipo_vegetacion = db.Column(db.String(80), default="Sin especificar")
    area_hectareas = db.Column(db.Numeric(12, 2), default=0)
    temperatura = db.Column(db.Numeric(4, 1), default=25)
    humedad = db.Column(db.Numeric(4, 1), default=40)
    velocidad_viento = db.Column(db.Numeric(4, 1), default=15)
    nivel_riesgo_sugerido = db.Column("nivel_riesgo", db.String(20))
    estado = db.Column(db.String(20), nullable=False, default="PENDIENTE")
    observacion_admin = db.Column("motivo_evaluacion", db.Text)
    id_zona = db.Column(db.Integer)
    id_evaluador = db.Column("id_administrador", db.Integer, db.ForeignKey("personas.id_persona", ondelete="SET NULL"))
    latitud = db.Column(db.Numeric(9, 6))
    longitud = db.Column(db.Numeric(9, 6))
    evidencia = db.Column(db.Text)
    fecha_solicitud = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    fecha_evaluacion = db.Column(db.DateTime(timezone=True))

    solicitante = db.relationship("Persona", foreign_keys=[id_ciudadano], lazy="joined")
    evaluador = db.relationship("Persona", foreign_keys=[id_evaluador], lazy="joined")

    def to_dict(self):
        return {
            "id_solicitud": self.id_solicitud,
            "id_ciudadano": self.id_ciudadano,
            "solicitante_nombre": (
                f"{self.solicitante.nombres} {self.solicitante.apellidos}".strip()
                if self.solicitante
                else f"Ciudadano #{self.id_ciudadano}"
            ),
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "ubicacion": self.ubicacion,
            "coordenadas": self.coordenadas or [],
            "tipo_vegetacion": self.tipo_vegetacion,
            "area_hectareas": float(self.area_hectareas or 0),
            "nivel_riesgo_sugerido": self.nivel_riesgo_sugerido,
            "latitud": float(self.latitud) if self.latitud is not None else None,
            "longitud": float(self.longitud) if self.longitud is not None else None,
            "evidencia": self.evidencia,
            "estado": self.estado,
            "observacion_admin": self.observacion_admin,
            "id_zona": self.id_zona,
            "id_evaluador": self.id_evaluador,
            "evaluador_nombre": (
                f"{self.evaluador.nombres} {self.evaluador.apellidos}".strip()
                if self.evaluador
                else None
            ),
            "fecha_solicitud": self.fecha_solicitud.isoformat() if self.fecha_solicitud else None,
            "fecha_evaluacion": self.fecha_evaluacion.isoformat() if self.fecha_evaluacion else None,
        }
