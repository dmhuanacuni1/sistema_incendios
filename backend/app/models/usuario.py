from app.config.database import db


class Persona(db.Model):
    __tablename__ = "personas"

    id_persona = db.Column(db.Integer, primary_key=True)
    nombres = db.Column(db.String(100), nullable=False)
    apellidos = db.Column(db.String(100), nullable=False)
    telefono = db.Column(db.String(20))
    correo = db.Column(db.String(255))
    direccion = db.Column(db.String(255))
    tipo_persona = db.Column(db.String(50), default="CIUDADANO")
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())


class Rol(db.Model):
    __tablename__ = "roles"

    id_rol = db.Column(db.Integer, primary_key=True)
    nombre_rol = db.Column(db.String(50), nullable=False, unique=True)
    descripcion = db.Column(db.Text)


class Usuario(db.Model):
    __tablename__ = "usuarios"

    id_usuario = db.Column(db.Integer, primary_key=True)
    id_persona = db.Column(
        db.Integer,
        db.ForeignKey("personas.id_persona", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    id_rol = db.Column(
        db.Integer,
        db.ForeignKey("roles.id_rol", ondelete="RESTRICT"),
        nullable=False,
    )
    nombre_usuario = db.Column(db.String(50), nullable=False, unique=True)
    hash_contrasena = db.Column(db.String(255), nullable=False)
    estado = db.Column(db.String(20), nullable=False, default="ACTIVO")
    fecha_creacion = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    persona = db.relationship("Persona", lazy="joined")
    rol = db.relationship("Rol", lazy="joined")
