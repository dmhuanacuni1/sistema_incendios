"""Mapa ORM de las tablas de la iteración 3: `brigadas` y `brigada_miembros`.

Solo se mapean las tablas de las que es dueña esta iteración. La tabla
`incidente_brigadas` pertenece a la iteración 5 (Incidentes): desde aquí solo
se consulta y se actualiza `estado_asignacion`, sin crear ni borrar filas.
"""

from app.config.database import db


class Brigada(db.Model):
    __tablename__ = "brigadas"

    id_brigada = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    estado = db.Column(db.String(30), nullable=False, default="ACTIVA")
    motivo_estado = db.Column(db.Text)
    min_integrantes = db.Column(db.Integer, nullable=False, default=2)
    max_integrantes = db.Column(db.Integer, nullable=False, default=8)
    id_estacion = db.Column(
        db.Integer,
        db.ForeignKey("estaciones.id_estacion", ondelete="RESTRICT"),
        nullable=False,
    )
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
    )


class BrigadaMiembro(db.Model):
    __tablename__ = "brigada_miembros"

    id_brigada_miembro = db.Column(db.Integer, primary_key=True)
    id_brigada = db.Column(
        db.Integer,
        db.ForeignKey("brigadas.id_brigada", ondelete="CASCADE"),
        nullable=False,
    )
    id_persona = db.Column(
        db.Integer,
        db.ForeignKey("personas.id_persona", ondelete="RESTRICT"),
        nullable=False,
    )
    rol_en_brigada = db.Column(db.String(50))
    fecha_incorporacion = db.Column(db.Date)
    estado = db.Column(db.String(20), nullable=False, default="PENDIENTE")


class NotificacionBrigada(db.Model):
    __tablename__ = "notificaciones_brigada"

    id_notificacion = db.Column(db.Integer, primary_key=True)
    id_brigada = db.Column(
        db.Integer,
        db.ForeignKey("brigadas.id_brigada", ondelete="CASCADE"),
        nullable=False,
    )
    id_persona = db.Column(
        db.Integer,
        db.ForeignKey("personas.id_persona", ondelete="CASCADE"),
        nullable=False,
    )
    tipo = db.Column(db.String(30), nullable=False, default="ASIGNACION_BRIGADA")
    estado = db.Column(db.String(20), nullable=False, default="PENDIENTE")
    mensaje = db.Column(db.Text)
    motivo_rechazo = db.Column(db.Text)
    fecha_creacion = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    fecha_respuesta = db.Column(db.DateTime(timezone=True))
