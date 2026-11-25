"""Servicio de gestion de informes estadisticos."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4, UUID
from hashlib import sha256
from sqlalchemy import text

from io import BytesIO
from openpyxl import load_workbook

from app.config.database import db
from app.models.reporte import Reporte
from app.models.contenido_reporte import ContenidoReporte
from app.models.archivo_reporte import ArchivoReporte
from app.models.usuario import Persona

from app.services.estadisticas_service import (
    obtener_estadisticas,
)
from app.services.informes_pdf import generar_pdf
from app.services.informes_excel import generar_excel


ZONA_HORARIA = timezone(timedelta(hours=-4))

FORMATOS_VALIDOS = ("PDF", "EXCEL")

TIPOS_REPORTE = {
    "GENERAL": "Informe general",
}

TAMANO_MAXIMO = 10 * 1024 * 1024


def construir_periodo(fecha_inicio=None, fecha_fin=None):
    if fecha_inicio and fecha_fin:
        return f"{fecha_inicio} al {fecha_fin}"

    if fecha_inicio:
        return f"Desde {fecha_inicio}"

    if fecha_fin:
        return f"Hasta {fecha_fin}"

    return "Todos los registros"


def preparar_informe(
    id_administrador,
    tipo_reporte="GENERAL",
    formato="PDF",
    fecha_inicio=None,
    fecha_fin=None,
    id_zona=None,
    nivel_riesgo=None,
):
    """Genera el documento sin guardar registros."""

    tipo_reporte = tipo_reporte.strip().upper()
    formato = formato.strip().upper()

    if tipo_reporte not in TIPOS_REPORTE:
        raise ValueError("Tipo de informe no valido")

    if formato not in FORMATOS_VALIDOS:
        raise ValueError("Formato de informe no valido")

    administrador = db.session.get(
        Persona,
        id_administrador,
    )

    if administrador is None:
        raise ValueError("Administrador no encontrado")

    nombre_administrador = (
        f"{administrador.nombres} "
        f"{administrador.apellidos}"
    ).strip()

    datos = obtener_estadisticas(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        id_zona=id_zona,
        nivel_riesgo=nivel_riesgo,
    )

    if datos["sin_datos"]:
        raise ValueError(
            "No existen incidentes para los filtros seleccionados"
        )

    periodo = construir_periodo(
        fecha_inicio,
        fecha_fin,
    )

    fecha_generacion = datetime.now(ZONA_HORARIA)

    fecha_texto = fecha_generacion.strftime(
        "%d/%m/%Y %H:%M:%S"
    )

    titulo = TIPOS_REPORTE[tipo_reporte]

    if formato == "PDF":
        contenido = generar_pdf(
            datos,
            titulo,
            periodo,
            nombre_administrador,
            fecha_texto,
        )

        extension = "pdf"
        tipo_mime = "application/pdf"

    else:
        contenido = generar_excel(
            datos,
            titulo,
            periodo,
            nombre_administrador,
            fecha_texto,
        )

        extension = "xlsx"

        tipo_mime = (
            "application/vnd.openxmlformats-"
            "officedocument.spreadsheetml.sheet"
        )

    if not contenido:
        raise ValueError("El documento generado esta vacio")

    if len(contenido) > TAMANO_MAXIMO:
        raise ValueError(
            "El documento supera el limite de 10 MB"
        )

    identificador = uuid4().hex[:12]

    nombre_archivo = (
        f"informe_{tipo_reporte.lower()}_"
        f"{fecha_generacion.strftime('%Y%m%d_%H%M%S')}_"
        f"{identificador}.{extension}"
    )

    return {
        "id_administrador": id_administrador,
        "tipo_reporte": tipo_reporte,
        "periodo": periodo,
        "formato": formato,
        "fecha_generacion": fecha_generacion,
        "nombre_archivo": nombre_archivo,
        "tipo_mime": tipo_mime,
        "contenido": contenido,
        "tamano_bytes": len(contenido),
    }


def generar_informe(
    id_administrador,
    tipo_reporte="GENERAL",
    formato="PDF",
    fecha_inicio=None,
    fecha_fin=None,
    id_zona=None,
    nivel_riesgo=None,
):
    """Genera y almacena el informe original en Neon."""

    try:
        datos = preparar_informe(
            id_administrador=id_administrador,
            tipo_reporte=tipo_reporte,
            formato=formato,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            id_zona=id_zona,
            nivel_riesgo=nivel_riesgo,
        )

        reporte = Reporte(
            id_administrador=datos["id_administrador"],
            tipo_reporte=datos["tipo_reporte"],
            periodo=datos["periodo"],
            formato=datos["formato"],
            fecha_generacion=datos["fecha_generacion"]
        )

        db.session.add(reporte)
        db.session.flush()

        reporte.archivo_url = (
            f"/api/informes/{reporte.id_reporte}/descargar"
        )

        archivo = ArchivoReporte(
            id_reporte=reporte.id_reporte,
            nombre_archivo=datos["nombre_archivo"],
            tipo_mime=datos["tipo_mime"],
            contenido=datos["contenido"],
            tamano_bytes=datos["tamano_bytes"],
        )

        db.session.add(archivo)
        db.session.flush()

        resultado = reporte.to_dict()
        resultado["archivo"] = archivo.to_dict()

        db.session.commit()

        return resultado

    except Exception:
        db.session.rollback()
        raise


def listar_informes():
    """Consulta el historial sin cargar archivos ni contenido JSON."""

    reportes = Reporte.query.order_by(
        Reporte.fecha_generacion.desc().nullslast(),
        Reporte.id_reporte.desc(),
    ).all()

    ids_contenido = {
        fila[0]
        for fila in db.session.query(
            ContenidoReporte.id_reporte
        ).all()
    }

    ids_archivos = {
        fila[0]
        for fila in db.session.query(
            ArchivoReporte.id_reporte
        ).all()
    }

    resultados = []

    for reporte in reportes:

        resultado = reporte.to_dict()

        tiene_contenido = (
            reporte.id_reporte in ids_contenido
        )

        tiene_archivo = (
            reporte.id_reporte in ids_archivos
        )

        resultado["contenido_disponible"] = tiene_contenido

        resultado["archivo_disponible"] = tiene_archivo

        if tiene_contenido:
            resultado["formatos_exportacion"] = [
                "PDF",
                "EXCEL",
            ]

        elif tiene_archivo:
            resultado["formatos_exportacion"] = [
                reporte.formato
            ]

        else:
            resultado["formatos_exportacion"] = []

        resultados.append(resultado)

    return resultados

def obtener_detalle_informe(id_reporte):
    """Consulta los metadatos y el contenido original del informe."""

    reporte = db.session.get(
        Reporte,
        id_reporte,
    )

    if reporte is None:
        return None

    archivo = db.session.get(
        ArchivoReporte,
        id_reporte,
    )

    contenido = db.session.get(
        ContenidoReporte,
        id_reporte,
    )

    resultado = reporte.to_dict()

    resultado["archivo"] = (
        archivo.to_dict()
        if archivo is not None
        else None
    )

    resultado["archivo_disponible"] = (
        archivo is not None
    )

    resultado["contenido"] = (
        contenido.to_dict()
        if contenido is not None
        else None
    )

    resultado["contenido_disponible"] = (
        contenido is not None
    )

    if contenido is not None:

        resultado["nombre_administrador"] = (
            contenido.nombre_administrador
        )

        resultado["formatos_exportacion"] = [
            "PDF",
            "EXCEL",
        ]

    elif archivo is not None:

        resultado["formatos_exportacion"] = [
            reporte.formato
        ]

    else:

        resultado["formatos_exportacion"] = []

    return resultado


def obtener_archivo_informe(id_reporte):
    """Recupera el documento binario original."""

    archivo = db.session.get(
        ArchivoReporte,
        id_reporte,
    )

    if archivo is None:
        return None

    return {
        "nombre_archivo": archivo.nombre_archivo,
        "tipo_mime": archivo.tipo_mime,
        "contenido": bytes(archivo.contenido),
        "tamano_bytes": archivo.tamano_bytes,
    }

def obtener_contenido_excel(id_reporte):
    """Consulta las hojas y formatos del documento Excel original."""

    archivo = obtener_archivo_informe(id_reporte)

    if archivo is None:
        return None

    tipo_excel = (
        "application/vnd.openxmlformats-"
        "officedocument.spreadsheetml.sheet"
    )

    if archivo["tipo_mime"] != tipo_excel:
        raise ValueError(
            "El informe seleccionado no es un archivo Excel"
        )

    try:
        libro = load_workbook(
            filename=BytesIO(archivo["contenido"]),
            read_only=True,
            data_only=True,
        )

    except Exception as exc:
        raise ValueError(
            "No se pudo leer el documento Excel original"
        ) from exc

    hojas = []

    try:
        for hoja in libro.worksheets:

            filas = []
            formatos = []

            for fila in hoja.iter_rows(values_only=False):

                valores = []
                formatos_fila = []

                for celda in fila:

                    valores.append(celda.value)

                    formatos_fila.append(
                        getattr(celda, "number_format", None)
                        or "General"
                    )

                # Eliminar celdas vacias al final
                while valores and valores[-1] is None:
                    valores.pop()
                    formatos_fila.pop()

                filas.append(valores)
                formatos.append(formatos_fila)

            # Eliminar filas vacias al final
            while filas and not filas[-1]:
                filas.pop()
                formatos.pop()

            hojas.append({
                "nombre": hoja.title,
                "total_filas": len(filas),
                "total_columnas": max(
                    (len(fila) for fila in filas),
                    default=0,
                ),
                "filas": filas,
                "formatos": formatos,
            })

        return {
            "id_reporte": id_reporte,
            "nombre_archivo": archivo["nombre_archivo"],
            "total_hojas": len(hojas),
            "hojas": hojas,
        }

    finally:
        libro.close()

def generar_informe_estructurado(
    id_administrador,
    tipo_reporte="GENERAL",
    fecha_inicio=None,
    fecha_fin=None,
    id_zona=None,
    nivel_riesgo=None,
    id_solicitud=None,
):
    """Genera y registra un informe evitando solicitudes duplicadas."""

    tipo_reporte = tipo_reporte.strip().upper()

    if tipo_reporte not in TIPOS_REPORTE:
        raise ValueError("Tipo de informe no valido")

    if id_solicitud is not None:

        try:
            id_solicitud = str(UUID(str(id_solicitud)))

        except (ValueError, TypeError, AttributeError):
            raise ValueError(
                "Identificador de solicitud no valido"
            )

    filtros_solicitud = {
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
        "id_zona": id_zona,
        "nivel_riesgo": nivel_riesgo,
    }

    try:

        # Control de solicitudes duplicadas
        if id_solicitud is not None:

            clave = f"{id_administrador}:{id_solicitud}"

            clave_bloqueo = int.from_bytes(
                sha256(clave.encode("utf-8")).digest()[:8],
                byteorder="big",
                signed=True,
            )

            # Bloqueo temporal durante la transaccion
            db.session.execute(
                text(
                    "SELECT pg_advisory_xact_lock(:clave)"
                ),
                {"clave": clave_bloqueo},
            )

            # Buscar una solicitud procesada anteriormente
            existente = (
                db.session.query(ContenidoReporte)
                .join(
                    Reporte,
                    Reporte.id_reporte ==
                    ContenidoReporte.id_reporte,
                )
                .filter(
                    Reporte.id_administrador ==
                    id_administrador,
                    ContenidoReporte.datos[
                        "_idempotencia"
                    ]["id_solicitud"].astext ==
                    id_solicitud,
                )
                .first()
            )

            if existente is not None:

                registro = existente.datos.get(
                    "_idempotencia",
                    {},
                )

                if (
                    registro.get("tipo_reporte") !=
                    tipo_reporte
                    or registro.get("filtros") !=
                    filtros_solicitud
                ):
                    raise ValueError(
                        "La solicitud ya fue utilizada "
                        "con parametros diferentes"
                    )

                resultado = obtener_detalle_informe(
                    existente.id_reporte
                )

                resultado["solicitud_reutilizada"] = True

                db.session.commit()

                return resultado

        # Verificar el administrador
        administrador = db.session.get(
            Persona,
            id_administrador,
        )

        if administrador is None:
            raise ValueError(
                "Administrador no encontrado"
            )

        # Consultar estadisticas
        datos = obtener_estadisticas(
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            id_zona=id_zona,
            nivel_riesgo=nivel_riesgo,
        )

        if datos["sin_datos"]:
            raise ValueError(
                "No existen datos para generar el informe"
            )

        # Guardar el identificador dentro del JSONB
        if id_solicitud is not None:

            datos["_idempotencia"] = {
                "id_solicitud": id_solicitud,
                "tipo_reporte": tipo_reporte,
                "filtros": filtros_solicitud,
            }

        periodo = construir_periodo(
            fecha_inicio,
            fecha_fin,
        )

        nombre_administrador = (
            f"{administrador.nombres} "
            f"{administrador.apellidos}"
        ).strip()

        fecha_generacion = datetime.now(
            ZONA_HORARIA
        )

        # Registrar los metadatos del informe
        reporte = Reporte(
            id_administrador=id_administrador,
            tipo_reporte=tipo_reporte,
            periodo=periodo,
            formato="JSON",
            fecha_generacion=fecha_generacion,
            archivo_url=None,
        )

        db.session.add(reporte)
        db.session.flush()

        # Registrar el contenido original
        contenido = ContenidoReporte(
            id_reporte=reporte.id_reporte,
            datos=datos,
            nombre_administrador=nombre_administrador,
            version_contenido=1,
        )

        db.session.add(contenido)
        db.session.flush()

        resultado = obtener_detalle_informe(
            reporte.id_reporte
        )

        resultado["solicitud_reutilizada"] = False

        db.session.commit()

        return resultado

    except Exception:

        db.session.rollback()

        raise

def exportar_informe_estructurado(id_reporte, formato):
    """Exporta un informe utilizando su contenido original."""

    formato = formato.strip().upper()

    if formato not in FORMATOS_VALIDOS:
        raise ValueError("Formato de exportacion no valido")

    reporte = db.session.get(
        Reporte,
        id_reporte,
    )

    if reporte is None:
        return None

    contenido = db.session.get(
        ContenidoReporte,
        id_reporte,
    )

    # Compatibilidad con informes anteriores
    if contenido is None:

        if reporte.formato != formato:
            raise ValueError(
                "El informe historico solamente esta "
                "disponible en su formato original"
            )

        return obtener_archivo_informe(id_reporte)

    datos = contenido.datos

    tipo_reporte = TIPOS_REPORTE.get(
        reporte.tipo_reporte,
        reporte.tipo_reporte,
    )

    fecha_generacion = (
        reporte.fecha_generacion
        .astimezone(ZONA_HORARIA)
        .strftime("%d/%m/%Y %H:%M:%S")
    )

    if formato == "PDF":

        archivo = generar_pdf(
            datos,
            tipo_reporte,
            reporte.periodo,
            contenido.nombre_administrador,
            fecha_generacion,
        )

        extension = "pdf"
        tipo_mime = "application/pdf"

    else:

        archivo = generar_excel(
            datos,
            tipo_reporte,
            reporte.periodo,
            contenido.nombre_administrador,
            fecha_generacion,
        )

        extension = "xlsx"

        tipo_mime = (
            "application/vnd.openxmlformats-"
            "officedocument.spreadsheetml.sheet"
        )

    if not archivo:
        raise ValueError(
            "No se pudo generar el archivo de exportacion"
        )

    if len(archivo) > TAMANO_MAXIMO:
        raise ValueError(
            "El archivo supera el tamano maximo permitido"
        )

    nombre_archivo = (
        f"informe_{reporte.tipo_reporte.lower()}_"
        f"{id_reporte}.{extension}"
    )

    return {
        "nombre_archivo": nombre_archivo,
        "tipo_mime": tipo_mime,
        "contenido": archivo,
        "tamano_bytes": len(archivo),
    }