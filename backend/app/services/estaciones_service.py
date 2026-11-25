"""Reglas de negocio de estaciones y consulta de infraestructura.

La tabla `estaciones` NO tiene columna `codigo` en la base de datos real:
la unicidad se valida por (`nombre`, `direccion`).
"""

import base64
import re
import unicodedata
from datetime import datetime, timezone

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import defer

from app.config.database import db
from app.models.estacion import Estacion, Recurso, Unidad
from app.views.recursos_view import (
    estacion_a_dict,
    recurso_a_dict,
    unidad_a_dict,
)

TELEFONO_RE = re.compile(r"^[0-9()+\-\s]{7,20}$")
FOTO_RE = re.compile(
    r"^data:image/(?P<tipo>png|jpe?g|webp|gif);base64,(?P<datos>[A-Za-z0-9+/]+={0,2})$",
    re.I,
)
# Las altas se comprimen en el navegador; el límite evita volver a llenar el TOAST.
FOTO_ALTA_RE = re.compile(
    r"^data:image/(?:png|jpe?g|webp);base64,(?P<datos>[A-Za-z0-9+/]+={0,2})$", re.I
)
MAX_FOTO_BYTES = 700_000

# Valores exactos de los CHECK de la base de datos (no etiquetas de la UI).
ESTADOS_UNIDAD = ("DISPONIBLE", "EN_MISION", "MANTENIMIENTO", "FUERA_DE_SERVICIO")
ESTADOS_RECURSO = (
    "DISPONIBLE",
    "EN_USO",
    "AGOTADO",
    "DANADO",
    "MANTENIMIENTO",
    "DE_BAJA",
)
ESTADOS_CON_MOTIVO = ("MANTENIMIENTO", "FUERA_DE_SERVICIO", "DE_BAJA", "DANADO")
# La baja de estaciones NO elimina la fila: solo cambia este estado.
ESTADOS_ESTACION = ("ACTIVA", "DE_BAJA")
TIPOS_RECURSO = ("equipo", "herramienta", "insumo")


class ErrorModulo(Exception):
    """Error de validación o persistencia con el campo responsable."""

    def __init__(self, mensaje, campo=None, codigo=400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.campo = campo
        self.codigo = codigo


def texto(data, campo, etiqueta, maximo, obligatorio=True):
    valor = data.get(campo, "")
    if valor is None:
        valor = ""
    if not isinstance(valor, str):
        raise ErrorModulo(f"{etiqueta}: debe ser texto", campo)
    valor = valor.strip()
    if obligatorio and not valor:
        raise ErrorModulo(f"{etiqueta}: es obligatorio", campo)
    if len(valor) > maximo:
        raise ErrorModulo(f"{etiqueta}: admite como máximo {maximo} caracteres", campo)
    return valor or None


def normalizar_estado(valor):
    """Acepta códigos de la BD y etiquetas escritas por el usuario."""
    if valor is None:
        raise ErrorModulo("Estado: es obligatorio", "estado")
    texto_plano = unicodedata.normalize("NFKD", str(valor)).encode("ascii", "ignore").decode()
    codigo = re.sub(r"[\s\-]+", "_", texto_plano.strip()).strip("_").upper()
    alias = {
        "EN_SERVICIO": "EN_MISION",
        "FUERA_DE_SERVICIO": "FUERA_DE_SERVICIO",
        "EN_MANTENIMIENTO": "MANTENIMIENTO",
    }
    codigo = alias.get(codigo, codigo)
    if codigo not in ESTADOS_UNIDAD + ESTADOS_RECURSO:
        raise ErrorModulo("Estado: no es un estado válido", "estado")
    return codigo


def normalizar_estado_estacion(valor):
    """Acepta el código de la BD y alias usados por la interfaz."""
    texto_plano = unicodedata.normalize("NFKD", str(valor)).encode("ascii", "ignore").decode()
    codigo = re.sub(r"[\s\-]+", "_", texto_plano.strip()).strip("_").upper()
    alias = {"ACTIVO": "ACTIVA", "INACTIVO": "DE_BAJA", "BAJA": "DE_BAJA"}
    codigo = alias.get(codigo, codigo)
    if codigo not in ESTADOS_ESTACION:
        raise ErrorModulo("Estado: usa ACTIVA o DE_BAJA", "estado")
    return codigo


def estado_estacion_desde(datos):
    """El estado puede enviarse como texto o como booleano `activo`."""
    if "estado" in datos and datos["estado"] not in (None, ""):
        return normalizar_estado_estacion(datos["estado"])
    if isinstance(datos.get("activo"), bool):
        return "ACTIVA" if datos["activo"] else "DE_BAJA"
    return None


def _telefono(data):
    valor = texto(data, "telefono", "Teléfono", 20)
    if not TELEFONO_RE.fullmatch(valor) or sum(c.isdigit() for c in valor) < 7:
        raise ErrorModulo(
            "Teléfono: usa de 7 a 20 caracteres entre dígitos, espacios, +, - o paréntesis",
            "telefono",
        )
    return valor


def _foto(data):
    """Acepta una data URL de imagen y la conserva como texto en la estación."""
    valor = data.get("foto_url")
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        return None
    if not isinstance(valor, str):
        raise ErrorModulo("Foto: el formato no es válido", "foto_url")

    valor = valor.strip()
    coincidencia = FOTO_ALTA_RE.fullmatch(valor)
    if coincidencia is None:
        raise ErrorModulo("Foto: usa una imagen PNG, JPG o WEBP", "foto_url")

    try:
        tamano = len(base64.b64decode(coincidencia.group("datos"), validate=True))
    except (ValueError, TypeError):
        raise ErrorModulo("Foto: la imagen no es válida", "foto_url")
    if tamano > MAX_FOTO_BYTES:
        raise ErrorModulo("Foto: la imagen debe pesar menos de 700 KB", "foto_url")
    return valor


def listar_estaciones():
    """Lista estaciones sin traer el blob base64 de la foto.

    `foto_url` es un TEXT con una data URL grande: leerlo en cada listado
    dispara el TOAST de Postgres y hace que la carga tarde más de 10 s.
    Con `defer` no se selecciona y `tiene_foto` se calcula en el propio SQL.
    """
    filas = (
        db.session.query(Estacion)
        .options(defer(Estacion.foto_url))
        .add_columns(Estacion.foto_url.isnot(None).label("tiene_foto"))
        .order_by(Estacion.nombre)
        .all()
    )
    resultado = []
    for estacion, tiene_foto in filas:
        estacion.tiene_foto = bool(tiene_foto)
        resultado.append(estacion)
    return resultado


def obtener_foto(id_estacion):
    """Devuelve (bytes, mimetype) de una sola estación, bajo demanda."""
    estacion = db.session.get(Estacion, id_estacion)
    if estacion is None:
        raise ErrorModulo("Estación no encontrada", codigo=404)

    coincidencia = FOTO_RE.fullmatch((estacion.foto_url or "").strip())
    if coincidencia is None:
        raise ErrorModulo("La estación no tiene una foto registrada", codigo=404)

    tipo = coincidencia.group("tipo").lower()
    if tipo == "jpg":
        tipo = "jpeg"
    try:
        contenido = base64.b64decode(coincidencia.group("datos"), validate=True)
    except (ValueError, TypeError):
        raise ErrorModulo("La foto registrada no es válida", codigo=500)
    return contenido, f"image/{tipo}"


def crear_estacion(data, administrador):
    """CU-01: validar y registrar una estación para el administrador en sesión."""
    if not isinstance(data, dict):
        raise ErrorModulo("Los datos de la estación no son válidos")

    nombre = texto(data, "nombre", "Nombre", 100)
    direccion = texto(data, "direccion", "Dirección", 255)
    telefono = _telefono(data)
    foto_url = _foto(data)

    repetida = (
        db.session.query(Estacion)
        .filter(db.func.lower(Estacion.nombre) == nombre.lower())
        .filter(db.func.lower(Estacion.direccion) == direccion.lower())
        .first()
    )
    if repetida is not None:
        raise ErrorModulo(
            "Nombre: ya existe una estación con ese nombre y dirección", "nombre"
        )

    estacion = Estacion(
        nombre=nombre,
        direccion=direccion,
        telefono=telefono,
        foto_url=foto_url,
        estado="ACTIVA",
        id_administrador=administrador.persona.id_persona,
    )
    db.session.add(estacion)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        raise ErrorModulo("No se pudo guardar la estación. Intenta de nuevo", codigo=500)
    estacion.tiene_foto = foto_url is not None
    return estacion


def actualizar_estacion(id_estacion, datos):
    """Edita una estación existente; `estado=DE_BAJA` es baja lógica (no DELETE).

    Acepta campos parciales: los que no vienen se conservan. Enviar `foto_url`
    vacío quita la foto; no enviarlo la deja intacta.
    """
    if not isinstance(datos, dict):
        raise ErrorModulo("Los datos de la estación no son válidos")

    estacion = db.session.get(Estacion, id_estacion)
    if estacion is None:
        raise ErrorModulo("Estación no encontrada", codigo=404)

    cambios = {}
    if "nombre" in datos:
        cambios["nombre"] = texto(datos, "nombre", "Nombre", 100)
    if "direccion" in datos:
        cambios["direccion"] = texto(datos, "direccion", "Dirección", 255)
    if "telefono" in datos:
        cambios["telefono"] = _telefono(datos)
    if "foto_url" in datos:
        cambios["foto_url"] = _foto(datos)

    estado = estado_estacion_desde(datos)
    if estado is not None:
        cambios["estado"] = estado
        if estado == "DE_BAJA":
            motivo = datos.get("motivo_baja")
            if motivo is not None and not isinstance(motivo, str):
                raise ErrorModulo("Motivo de baja: debe ser texto", "motivo_baja")
            motivo = (motivo or "").strip() or "Baja registrada desde el sistema"
            if len(motivo) > 500:
                raise ErrorModulo(
                    "Motivo de baja: admite como máximo 500 caracteres", "motivo_baja"
                )
            cambios["motivo_baja"] = motivo
            cambios["fecha_baja"] = datetime.now(timezone.utc)
        else:
            cambios["motivo_baja"] = None
            cambios["fecha_baja"] = None

    nombre = cambios.get("nombre", estacion.nombre)
    direccion = cambios.get("direccion", estacion.direccion)
    repetida = (
        db.session.query(Estacion)
        .filter(db.func.lower(Estacion.nombre) == nombre.lower())
        .filter(db.func.lower(Estacion.direccion) == direccion.lower())
        .filter(Estacion.id_estacion != id_estacion)
        .first()
    )
    if repetida is not None:
        raise ErrorModulo(
            "Nombre: ya existe otra estación con ese nombre y dirección", "nombre"
        )

    for campo, valor in cambios.items():
        setattr(estacion, campo, valor)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        raise ErrorModulo("No se pudo actualizar la estación. Intenta de nuevo", codigo=500)

    if "foto_url" in cambios:
        estacion.tiene_foto = bool(cambios["foto_url"])
    else:
        estacion.tiene_foto = bool(
            db.session.query(Estacion.foto_url.isnot(None))
            .filter(Estacion.id_estacion == id_estacion)
            .scalar()
        )
    return estacion


def consultar(estado=None):
    """CU-04: estaciones con sus unidades y recursos.

    `estado` filtra los hijos por un estado exacto de la base de datos.
    """
    filtro = None
    if estado is not None and str(estado).strip():
        filtro = normalizar_estado(estado)

    estaciones = listar_estaciones()
    if not estaciones:
        return []

    por_id = {estacion.id_estacion: estacion for estacion in estaciones}
    ids = list(por_id)
    consulta_unidades = Unidad.query.filter(Unidad.id_estacion.in_(ids))
    consulta_recursos = Recurso.query.filter(Recurso.id_estacion.in_(ids))
    if filtro:
        if filtro in ESTADOS_UNIDAD:
            consulta_unidades = consulta_unidades.filter_by(estado=filtro)
        if filtro in ESTADOS_RECURSO:
            consulta_recursos = consulta_recursos.filter_by(estado=filtro)

    unidades = {id_estacion: [] for id_estacion in ids}
    recursos = {id_estacion: [] for id_estacion in ids}
    for unidad in consulta_unidades.order_by(Unidad.codigo).all():
        unidades[unidad.id_estacion].append(unidad_a_dict(unidad, por_id[unidad.id_estacion]))
    for recurso in consulta_recursos.order_by(Recurso.nombre).all():
        recursos[recurso.id_estacion].append(
            recurso_a_dict(recurso, por_id[recurso.id_estacion])
        )

    return [
        {
            **estacion_a_dict(estacion),
            "unidades": unidades[estacion.id_estacion],
            "recursos": recursos[estacion.id_estacion],
        }
        for estacion in estaciones
    ]
