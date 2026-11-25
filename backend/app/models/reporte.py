"""Modelo SQLAlchemy para la tabla reportes."""

from app.config.database import db


FORMATOS_REPORTE = ("PDF", "EXCEL", "CSV", "JSON")


class Reporte(db.Model):
    """Registro de informes generados por administradores."""

    __tablename__ = "reportes"

    id_reporte = db.Column(
        db.Integer,
        primary_key=True,
        autoincrement=True,
    )

    id_administrador = db.Column(
        db.Integer,
        db.ForeignKey(
            "personas.id_persona",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    tipo_reporte = db.Column(
        db.String(100),
        nullable=False,
    )

    fecha_generacion = db.Column(
    db.DateTime(timezone=True),
    server_default=db.func.now(),
    nullable=True
)

    periodo = db.Column(
        db.String(50),
        nullable=False,
    )

    formato = db.Column(
        db.String(20),
        nullable=False,
    )

    archivo_url = db.Column(
        db.Text,
        nullable=True,
    )

    administrador = db.relationship(
        "Persona",
        lazy="joined",
    )

    def to_dict(self):
        nombre_administrador = None

        if self.administrador:
            nombre_administrador = (
                f"{self.administrador.nombres} "
                f"{self.administrador.apellidos}"
            ).strip()

        return {
            "id_reporte": self.id_reporte,
            "id_administrador": self.id_administrador,
            "nombre_administrador": nombre_administrador,
            "tipo_reporte": self.tipo_reporte,
            "fecha_generacion": (
                self.fecha_generacion.isoformat()
                if self.fecha_generacion
                else None
            ),
            "periodo": self.periodo,
            "formato": self.formato,
            "archivo_disponible": bool(self.archivo_url),
        }