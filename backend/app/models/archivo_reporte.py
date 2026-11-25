"""Modelo SQLAlchemy para la tabla archivos_reportes."""
from sqlalchemy.orm import deferred
from app.config.database import db
from app.models.reporte import Reporte


class ArchivoReporte(db.Model):
    """Almacena los documentos originales de los reportes."""

    __tablename__ = "archivos_reportes"

    id_reporte = db.Column(
        db.Integer,
        db.ForeignKey(
            "reportes.id_reporte",
            ondelete="CASCADE",
        ),
        primary_key=True,
        autoincrement=False,
    )

    nombre_archivo = db.Column(
        db.String(255),
        nullable=False,
    )

    tipo_mime = db.Column(
        db.String(150),
        nullable=False,
    )

    contenido = deferred(
    db.Column(
        db.LargeBinary,
        nullable=False,
    )
)

    tamano_bytes = db.Column(
        db.BigInteger,
        nullable=False,
    )

    reporte = db.relationship(
        Reporte,
        lazy="select",
    )

    __table_args__ = (
        db.CheckConstraint(
            "tamano_bytes > 0 AND "
            "tamano_bytes = octet_length(contenido)",
            name="chk_tamano_archivo",
        ),
    )

    def to_dict(self):
        return {
            "id_reporte": self.id_reporte,
            "nombre_archivo": self.nombre_archivo,
            "tipo_mime": self.tipo_mime,
            "tamano_bytes": self.tamano_bytes,
        }