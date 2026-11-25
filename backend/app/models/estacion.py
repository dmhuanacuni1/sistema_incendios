"""Mapa ORM de las tablas físicas ya existentes en la base de datos.

No crea ni modifica tablas: solo mapea `estaciones`, `unidades` y `recursos`
respetando los nombres reales de columnas y llaves foráneas.
"""

from app.config.database import db


class Estacion(db.Model):
    __tablename__ = "estaciones"

    id_estacion = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    direccion = db.Column(db.String(255), nullable=False)
    telefono = db.Column(db.String(20))
    foto_url = db.Column(db.Text)
    estado = db.Column(db.String(20), nullable=False, default="ACTIVA", server_default="ACTIVA")
    motivo_baja = db.Column(db.Text)
    fecha_baja = db.Column(db.DateTime(timezone=True))
    id_administrador = db.Column(
        db.Integer, db.ForeignKey("personas.id_persona", ondelete="SET NULL")
    )
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
    )


class Unidad(db.Model):
    __tablename__ = "unidades"

    id_unidad = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(50), nullable=False, unique=True)
    tipo = db.Column(db.String(50), nullable=False)
    capacidad = db.Column(db.String(50))
    estado = db.Column(db.String(30), nullable=False, default="DISPONIBLE")
    motivo_estado = db.Column(db.Text)
    id_estacion = db.Column(
        db.Integer,
        db.ForeignKey("estaciones.id_estacion", ondelete="RESTRICT"),
        nullable=False,
    )
    id_administrador = db.Column(
        db.Integer, db.ForeignKey("personas.id_persona", ondelete="SET NULL")
    )
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
    )


class Recurso(db.Model):
    __tablename__ = "recursos"

    id_recurso = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    tipo_recurso = db.Column(db.String(30), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False, default=0)
    estado = db.Column(db.String(30), nullable=False, default="DISPONIBLE")
    motivo_estado = db.Column(db.Text)
    id_estacion = db.Column(
        db.Integer,
        db.ForeignKey("estaciones.id_estacion", ondelete="RESTRICT"),
        nullable=False,
    )
    id_administrador = db.Column(
        db.Integer, db.ForeignKey("personas.id_persona", ondelete="SET NULL")
    )
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
    )
