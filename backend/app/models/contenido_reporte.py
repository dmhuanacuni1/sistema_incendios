"""Modelo de almacenamiento del contenido original de informes."""

from sqlalchemy import event, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.schema import CheckConstraint

from app.config.database import db


@compiles(JSONB, "sqlite")
def _compilar_jsonb_como_json_en_sqlite(type_, compiler, **kw):
    # SQLite no tiene JSONB; las pruebas aisladas usan JSON nativo.
    return "JSON"


@event.listens_for(db.Model.metadata, "before_create", named="sqlite_contenido_checks")
def _checks_sqlite(target, connection, **kw):
    if connection.dialect.name != "sqlite":
        return
    tabla = target.tables.get("contenido_reportes")
    if tabla is None:
        return
    for constraint in tabla.constraints:
        if (
            isinstance(constraint, CheckConstraint)
            and constraint.name == "chk_contenido_reportes_datos"
        ):
            constraint.sqltext = text("json_type(datos) = 'object'")


class ContenidoReporte(db.Model):
    """Conserva los datos originales de un informe generado."""

    __tablename__ = "contenido_reportes"

    id_reporte = db.Column(
        db.Integer,
        db.ForeignKey(
            "reportes.id_reporte",
            ondelete="CASCADE",
        ),
        primary_key=True,
        autoincrement=False,
    )

    datos = db.Column(
        JSONB,
        nullable=False,
    )

    nombre_administrador = db.Column(
        db.String(255),
        nullable=False,
    )

    version_contenido = db.Column(
        db.Integer,
        nullable=False,
        server_default="1",
    )

    reporte = db.relationship(
        "Reporte",
        lazy="select",
    )

    __table_args__ = (
        db.CheckConstraint(
            "jsonb_typeof(datos) = 'object'",
            name="chk_contenido_reportes_datos",
        ),
        db.CheckConstraint(
            "version_contenido > 0",
            name="chk_version_contenido",
        ),
    )

    def to_dict(self):
        """Devuelve el contenido original del informe."""

        return {
            "id_reporte": self.id_reporte,
            "datos": self.datos,
            "nombre_administrador": self.nombre_administrador,
            "version_contenido": self.version_contenido,
        }