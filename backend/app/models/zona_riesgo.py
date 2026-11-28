"""
Modelos SQLAlchemy para el modulo Gestion de Zonas de Riesgo.
Refleja la tabla zonas_riesgo existente + tablas auxiliares.
"""

from datetime import datetime, timezone
from app.config.database import db


class ZonaRiesgo(db.Model):
    __tablename__ = "zonas_riesgo"

    id_zona = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    ubicacion = db.Column(db.Text, nullable=False)
    nivel_riesgo = db.Column(db.String(20), nullable=False)
    descripcion = db.Column(db.Text)
    id_administrador = db.Column(db.Integer, nullable=True)

    # Columnas ampliadas (migracion no destructiva)
    coordenadas = db.Column(db.JSON, default=list)
    tipo_vegetacion = db.Column(db.String(80), default="Pastizal seco")
    area_hectareas = db.Column(db.Numeric(12, 2), default=0.0)
    estado = db.Column(db.String(20), default="Activa")
    temperatura = db.Column(db.Numeric(4, 1), default=25.0)
    humedad = db.Column(db.Numeric(4, 1), default=40.0)
    velocidad_viento = db.Column(db.Numeric(4, 1), default=15.0)

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relaciones
    focos_calor = db.relationship("FocoCalorSatelital", backref="zona", lazy="dynamic", cascade="all, delete-orphan")
    alertas_preventivas = db.relationship("AlertaPreventiva", backref="zona", lazy="dynamic", cascade="all, delete-orphan")

    NIVELES_VALIDOS = ("BAJO", "MEDIO", "ALTO", "EXTREMO")
    ESTADOS_VALIDOS = ("Activa", "Inactiva", "Alerta Emitida")

    def _centro(self):
        """Latitud/longitud de referencia: centro de los puntos guardados en `coordenadas`."""
        puntos = []
        for p in self.coordenadas or []:
            try:
                puntos.append((float(p["lat"]), float(p["lng"])))
            except (TypeError, KeyError, ValueError):
                continue
        if not puntos:
            return (None, None)
        return (
            round(sum(p[0] for p in puntos) / len(puntos), 6),
            round(sum(p[1] for p in puntos) / len(puntos), 6),
        )

    def to_dict(self, incluir_incidentes=False):
        data = {
            "id_zona": self.id_zona,
            "nombre": self.nombre,
            "ubicacion": self.ubicacion,
            "nivel_riesgo": self.nivel_riesgo,
            "descripcion": self.descripcion,
            "id_administrador": self.id_administrador,
            "coordenadas": self.coordenadas or [],
            "latitud": self._centro()[0],
            "longitud": self._centro()[1],
            "tipo_vegetacion": self.tipo_vegetacion,
            "area_hectareas": float(self.area_hectareas) if self.area_hectareas else 0.0,
            "estado": self.estado,
            "temperatura": float(self.temperatura) if self.temperatura else 25.0,
            "humedad": float(self.humedad) if self.humedad else 40.0,
            "velocidad_viento": float(self.velocidad_viento) if self.velocidad_viento else 15.0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if incluir_incidentes:
            from app.models.incidente import Incidente  # import local para evitar ciclos
            total = Incidente.query.filter_by(id_zona=self.id_zona).count()
            data["total_incidentes"] = total
        return data


class FocoCalorSatelital(db.Model):
    __tablename__ = "focos_calor_satelital"

    id_foco = db.Column(db.Integer, primary_key=True)
    id_zona = db.Column(db.Integer, db.ForeignKey("zonas_riesgo.id_zona", ondelete="CASCADE"), nullable=True)
    latitud = db.Column(db.Numeric(10, 6), nullable=False)
    longitud = db.Column(db.Numeric(10, 6), nullable=False)
    temperatura_brillo = db.Column(db.Numeric(5, 1))
    satelite_sensor = db.Column(db.String(50), default="VIIRS / NOAA-20")
    confianza = db.Column(db.String(20), default="Alta")
    fecha_deteccion = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id_foco": self.id_foco,
            "id_zona": self.id_zona,
            "latitud": float(self.latitud),
            "longitud": float(self.longitud),
            "temperatura_brillo": float(self.temperatura_brillo) if self.temperatura_brillo else None,
            "satelite_sensor": self.satelite_sensor,
            "confianza": self.confianza,
            "fecha_deteccion": self.fecha_deteccion.isoformat() if self.fecha_deteccion else None,
        }


class AlertaPreventiva(db.Model):
    __tablename__ = "alertas_preventivas"

    id_alerta = db.Column(db.Integer, primary_key=True)
    id_zona = db.Column(db.Integer, db.ForeignKey("zonas_riesgo.id_zona", ondelete="CASCADE"), nullable=False)
    nivel_alerta = db.Column(db.String(20), nullable=False)
    mensaje = db.Column(db.Text, nullable=False)
    observaciones = db.Column(db.Text)
    emitido_por = db.Column(db.Integer, nullable=True)
    fecha_emision = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    NIVELES_VALIDOS = ("Naranja", "Roja")

    def to_dict(self):
        return {
            "id_alerta": self.id_alerta,
            "id_zona": self.id_zona,
            "nivel_alerta": self.nivel_alerta,
            "mensaje": self.mensaje,
            "observaciones": self.observaciones,
            "emitido_por": self.emitido_por,
            "fecha_emision": self.fecha_emision.isoformat() if self.fecha_emision else None,
        }


class SuperficieQuemada(db.Model):
    __tablename__ = "superficie_quemada_departamento"

    id_registro = db.Column(db.Integer, primary_key=True)
    anio = db.Column(db.Integer, nullable=False)
    departamento = db.Column(db.String(50), nullable=False)
    hectareas = db.Column(db.Numeric(14, 0), nullable=False, default=0)
