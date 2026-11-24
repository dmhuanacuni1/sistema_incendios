"""Modelos ORM para la iteración 6: Alertas y Notificaciones."""
from datetime import datetime, timezone
from app.config.database import db


class TipoAlerta(db.Model):
    __tablename__ = "tipos_alerta"

    id_tipo_alerta = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)
    plantilla_mensaje = db.Column(db.Text, nullable=False)


class Alerta(db.Model):
    __tablename__ = "alertas"

    id_alerta = db.Column(db.Integer, primary_key=True)
    id_incidente = db.Column(
        db.Integer, 
        db.ForeignKey("incidentes.id_incidente", ondelete="CASCADE"), 
        nullable=True
    )
    id_tipo_alerta = db.Column(
        db.Integer, 
        db.ForeignKey("tipos_alerta.id_tipo_alerta", ondelete="RESTRICT"), 
        nullable=False
    )
    fecha_hora = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    mensaje = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relaciones
    tipo = db.relationship("TipoAlerta", lazy="joined")
    incidente = db.relationship("Incidente", lazy="joined")
    destinatarios = db.relationship("AlertaDestinatario", backref="alerta", lazy="dynamic", cascade="all, delete-orphan")


class AlertaDestinatario(db.Model):
    __tablename__ = "alerta_destinatarios"

    id_alerta = db.Column(
        db.Integer, 
        db.ForeignKey("alertas.id_alerta", ondelete="CASCADE"), 
        primary_key=True
    )
    id_persona = db.Column(
        db.Integer, 
        db.ForeignKey("personas.id_persona", ondelete="CASCADE"), 
        primary_key=True
    )
    estado_envio = db.Column(db.String(30), default="PENDIENTE")
    confirmada = db.Column(db.Boolean, default=False)
    fecha_confirmacion = db.Column(db.DateTime(timezone=True), nullable=True)

    # Relación con la Persona (para saber a quién se le envía)
    persona = db.relationship("Persona", lazy="joined")