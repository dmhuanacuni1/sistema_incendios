"""Generacion de informes estadisticos en formato PDF."""

from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


COLOR_PRINCIPAL = colors.HexColor("#C2410C")
COLOR_OSCURO = colors.HexColor("#292524")
COLOR_CLARO = colors.HexColor("#FFF7ED")
COLOR_BORDE = colors.HexColor("#E7E5E4")


def crear_tabla(filas, anchos):
    tabla = Table(
        filas,
        colWidths=anchos,
        repeatRows=1,
        hAlign="LEFT",
    )

    tabla.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRINCIPAL),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [
            colors.white,
            COLOR_CLARO,
        ]),
        ("GRID", (0, 0), (-1, -1), 0.4, COLOR_BORDE),
    ]))

    return tabla


def pie_pagina(canvas, documento):
    canvas.saveState()

    ancho, alto = A4

    canvas.setStrokeColor(COLOR_BORDE)
    canvas.line(
        2 * cm,
        1.7 * cm,
        ancho - 2 * cm,
        1.7 * cm,
    )

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(COLOR_OSCURO)

    canvas.drawString(
        2 * cm,
        1.2 * cm,
        "Vigia Territorial - Estadisticas e Informes",
    )

    canvas.drawRightString(
        ancho - 2 * cm,
        1.2 * cm,
        f"Pagina {documento.page}",
    )

    canvas.restoreState()


def generar_pdf(
    datos,
    tipo_reporte,
    periodo,
    administrador,
    fecha_generacion,
):
    buffer = BytesIO()

    documento = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2.3 * cm,
        title="Informe estadistico - Vigia Territorial",
        author="Vigia Territorial",
    )

    estilos = getSampleStyleSheet()

    estilos.add(ParagraphStyle(
        name="TituloInforme",
        fontName="Helvetica-Bold",
        fontSize=21,
        leading=26,
        textColor=COLOR_PRINCIPAL,
        spaceAfter=12,
    ))

    estilos.add(ParagraphStyle(
        name="SubtituloInforme",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=COLOR_OSCURO,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True,
    ))

    elementos = []

    elementos.append(Paragraph(
        "Vigía Territorial",
        estilos["TituloInforme"],
    ))

    elementos.append(Paragraph(
        "Informe de estadísticas de incendios",
        estilos["Heading2"],
    ))

    elementos.append(Spacer(1, 12))

    metadatos = [
        ("Tipo de informe", tipo_reporte),
        ("Periodo", periodo),
        ("Generado por", administrador),
        ("Fecha de generación", fecha_generacion),
    ]

    for etiqueta, valor in metadatos:
        elementos.append(Paragraph(
            f"<b>{etiqueta}:</b> {escape(str(valor))}",
            estilos["Normal"],
        ))

    elementos.append(Spacer(1, 12))

    if datos.get("sin_datos"):
        elementos.append(Paragraph(
            "No se encontraron incidentes para los filtros seleccionados.",
            estilos["Normal"],
        ))

    filtros = datos.get("filtros", {})

    elementos.append(Paragraph(
        "Filtros aplicados",
        estilos["SubtituloInforme"],
    ))

    filas_filtros = [
        ["Filtro", "Valor"],
        ["Fecha inicial", filtros.get("fecha_inicio") or "Sin límite"],
        ["Fecha final", filtros.get("fecha_fin") or "Sin límite"],
        ["ID de zona", filtros.get("id_zona") or "Todas"],
        ["Nivel de riesgo", filtros.get("nivel_riesgo") or "Todos"],
    ]

    elementos.append(crear_tabla(
        filas_filtros,
        [9 * cm, 8 * cm],
    ))

    elementos.append(Paragraph(
        "Resumen de indicadores",
        estilos["SubtituloInforme"],
    ))

    estados = datos.get("por_estado", {})
    danos = datos.get("danos", {})

    duracion = datos.get("tiempo_promedio_cierre_horas")

    texto_duracion = (
        f"{duracion:.2f} horas"
        if duracion is not None
        else "Sin datos"
    )

    filas_indicadores = [
        ["Indicador", "Resultado"],
        ["Total de incidentes", datos.get("total_incidentes", 0)],
        ["Incidentes activos", estados.get("ACTIVO", 0)],
        ["Incidentes controlados", estados.get("CONTROLADO", 0)],
        ["Incidentes extinguidos", estados.get("EXTINGUIDO", 0)],
        ["Incidentes cerrados", estados.get("CERRADO", 0)],
        ["Porcentaje de cerrados",
         f"{datos.get('porcentaje_cerrados', 0):.2f}%"],
        ["Evaluaciones de daños",
         danos.get("total_evaluaciones", 0)],
        ["Costo total estimado",
         f"Bs {danos.get('costo_total_estimado', 0):,.2f}"],
        ["Tiempo promedio de cierre", texto_duracion],
    ]

    elementos.append(crear_tabla(
        filas_indicadores,
        [11 * cm, 6 * cm],
    ))

    elementos.append(Paragraph(
        "Distribución por estado",
        estilos["SubtituloInforme"],
    ))

    porcentajes_estado = datos.get("porcentaje_estado", {})

    filas_estado = [
        ["Estado", "Cantidad", "Porcentaje"],
    ]

    for estado in (
        "ACTIVO",
        "CONTROLADO",
        "EXTINGUIDO",
        "CERRADO",
    ):
        filas_estado.append([
            estado,
            estados.get(estado, 0),
            f"{porcentajes_estado.get(estado, 0):.2f}%",
        ])

    elementos.append(crear_tabla(
        filas_estado,
        [7 * cm, 5 * cm, 5 * cm],
    ))

    elementos.append(Paragraph(
        "Distribución por gravedad",
        estilos["SubtituloInforme"],
    ))

    gravedades = datos.get("por_gravedad", {})
    porcentajes_gravedad = datos.get(
        "porcentaje_gravedad", {}
    )

    filas_gravedad = [
        ["Gravedad", "Cantidad", "Porcentaje"],
    ]

    for gravedad in (
        "BAJA",
        "MEDIA",
        "ALTA",
        "CATASTROFICA",
    ):
        filas_gravedad.append([
            gravedad,
            gravedades.get(gravedad, 0),
            f"{porcentajes_gravedad.get(gravedad, 0):.2f}%",
        ])

    elementos.append(crear_tabla(
        filas_gravedad,
        [7 * cm, 5 * cm, 5 * cm],
    ))

    elementos.append(Paragraph(
        "Frecuencia de incidentes por zona",
        estilos["SubtituloInforme"],
    ))

    filas_zonas = [
        ["Zona", "Riesgo", "Cantidad", "Porcentaje"],
    ]

    for zona in datos.get("por_zona", []):
        filas_zonas.append([
            Paragraph(
                escape(str(zona["nombre"])),
                estilos["Normal"],
            ),
            zona.get("nivel_riesgo") or "Sin asignar",
            zona["cantidad"],
            f"{zona['porcentaje']:.2f}%",
        ])

    if len(filas_zonas) == 1:
        filas_zonas.append([
            "Sin registros", "-", 0, "0.00%"
        ])

    elementos.append(crear_tabla(
        filas_zonas,
        [7 * cm, 3.5 * cm, 3 * cm, 3.5 * cm],
    ))

    elementos.append(Paragraph(
        "Evaluación de daños",
        estilos["SubtituloInforme"],
    ))

    niveles = danos.get("por_nivel", {})

    filas_danos = [
        ["Nivel de daño", "Cantidad"],
    ]

    for nivel in (
        "LEVE",
        "MODERADO",
        "SEVERO",
        "TOTAL",
    ):
        filas_danos.append([
            nivel,
            niveles.get(nivel, 0),
        ])

    elementos.append(crear_tabla(
        filas_danos,
        [11 * cm, 6 * cm],
    ))

    documento.build(
        elementos,
        onFirstPage=pie_pagina,
        onLaterPages=pie_pagina,
    )

    contenido = buffer.getvalue()
    buffer.close()

    return contenido