"""Generacion de informes estadisticos en formato Excel."""

from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import (
    Font,
    PatternFill,
    Alignment,
    Border,
    Side,
)
from openpyxl.chart import BarChart, PieChart, Reference
from openpyxl.utils import get_column_letter


COLOR_PRINCIPAL = "C2410C"
COLOR_OSCURO = "292524"
COLOR_CLARO = "FFF7ED"
COLOR_BORDE = "E7E5E4"
COLOR_BLANCO = "FFFFFF"

FORMATO_MONEDA = '"Bs" #,##0.00'
FORMATO_PORCENTAJE = "0.00%"


def agregar_fila(hoja, valores):
    """Agrega valores evitando formulas en textos externos."""

    hoja.append(valores)

    for celda in hoja[hoja.max_row]:
        if isinstance(celda.value, str):
            celda.data_type = "s"


def aplicar_estilos(hoja, fila_encabezado=1):
    """Aplica el estilo visual de Vigia Territorial."""

    borde = Border(
        bottom=Side(
            style="thin",
            color=COLOR_BORDE,
        )
    )

    for celda in hoja[fila_encabezado]:
        celda.fill = PatternFill(
            fill_type="solid",
            fgColor=COLOR_PRINCIPAL,
        )

        celda.font = Font(
            name="Calibri",
            bold=True,
            color=COLOR_BLANCO,
            size=11,
        )

        celda.alignment = Alignment(
            vertical="center",
            horizontal="center",
            wrap_text=True,
        )

    hoja.row_dimensions[fila_encabezado].height = 28

    for fila in hoja.iter_rows(
        min_row=fila_encabezado + 1
    ):
        for celda in fila:
            celda.font = Font(
                name="Calibri",
                color=COLOR_OSCURO,
                size=11,
            )

            celda.alignment = Alignment(
                vertical="center",
                wrap_text=True,
            )

            celda.border = borde

            if celda.row % 2 == 0:
                celda.fill = PatternFill(
                    fill_type="solid",
                    fgColor=COLOR_CLARO,
                )

        hoja.row_dimensions[fila[0].row].height = 24

    for columna in hoja.columns:
        longitud = max(
            (
                len(str(celda.value))
                if celda.value is not None
                else 0
            )
            for celda in columna
        )

        letra = get_column_letter(columna[0].column)

        hoja.column_dimensions[letra].width = min(
            max(longitud + 5, 16),
            65,
        )

    hoja.freeze_panes = f"A{fila_encabezado + 1}"
    hoja.sheet_view.showGridLines = False
    hoja.sheet_properties.tabColor = COLOR_PRINCIPAL


def agregar_grafico_barras(
    hoja,
    titulo,
    posicion="F2",
):
    if hoja.max_row < 2:
        return

    grafico = BarChart()

    grafico.title = titulo
    grafico.type = "col"
    grafico.style = 10
    grafico.y_axis.title = "Cantidad"
    grafico.width = 19
    grafico.height = 11
    grafico.legend = None

    valores = Reference(
        hoja,
        min_col=2,
        min_row=1,
        max_row=hoja.max_row,
    )

    categorias = Reference(
        hoja,
        min_col=1,
        min_row=2,
        max_row=hoja.max_row,
    )

    grafico.add_data(
        valores,
        titles_from_data=True,
    )

    grafico.set_categories(categorias)

    grafico.series[0].graphicalProperties.solidFill = (
        COLOR_PRINCIPAL
    )

    hoja.add_chart(grafico, posicion)


def agregar_grafico_circular(hoja):
    if hoja.max_row < 2:
        return

    total = sum(
        hoja.cell(fila, 2).value or 0
        for fila in range(2, hoja.max_row + 1)
    )

    if total == 0:
        return

    grafico = PieChart()

    grafico.title = "Distribucion por estado"
    grafico.width = 18
    grafico.height = 11

    valores = Reference(
        hoja,
        min_col=2,
        min_row=1,
        max_row=hoja.max_row,
    )

    categorias = Reference(
        hoja,
        min_col=1,
        min_row=2,
        max_row=hoja.max_row,
    )

    grafico.add_data(
        valores,
        titles_from_data=True,
    )

    grafico.set_categories(categorias)

    hoja.add_chart(grafico, "F2")


def generar_excel(
    datos,
    tipo_reporte,
    periodo,
    administrador,
    fecha_generacion,
):
    libro = Workbook()

    libro.properties.creator = "Vigia Territorial"
    libro.properties.title = "Informe estadistico"
    libro.properties.subject = "Estadisticas de incendios"

    estados = datos.get("por_estado", {})
    gravedades = datos.get("por_gravedad", {})
    danos = datos.get("danos", {})
    filtros = datos.get("filtros", {})

    # HOJA 1: RESUMEN

    resumen = libro.active
    resumen.title = "Resumen"

    filas_resumen = [
        ["Indicador", "Resultado"],
        ["Sistema", "Vigía Territorial"],
        ["Tipo de informe", tipo_reporte],
        ["Periodo", periodo],
        ["Generado por", administrador],
        ["Fecha de generación", fecha_generacion],
        ["Total de incidentes",
         datos.get("total_incidentes", 0)],
        ["Incidentes activos",
         estados.get("ACTIVO", 0)],
        ["Incidentes controlados",
         estados.get("CONTROLADO", 0)],
        ["Incidentes extinguidos",
         estados.get("EXTINGUIDO", 0)],
        ["Incidentes cerrados",
         estados.get("CERRADO", 0)],
        ["Porcentaje de cerrados",
         datos.get("porcentaje_cerrados", 0) / 100],
        ["Evaluaciones de daños",
         danos.get("total_evaluaciones", 0)],
        ["Costo total estimado",
         danos.get("costo_total_estimado", 0)],
        ["Tiempo promedio de cierre (horas)",
         datos.get("tiempo_promedio_cierre_horas")],
        ["Sin datos",
         "Sí" if datos.get("sin_datos") else "No"],
    ]

    for fila in filas_resumen:
        agregar_fila(resumen, fila)

    resumen["B12"].number_format = FORMATO_PORCENTAJE
    resumen["B14"].number_format = FORMATO_MONEDA
    resumen["B15"].number_format = "0.00"

    if resumen["B15"].value is None:
        resumen["B15"] = "Sin datos"

    aplicar_estilos(resumen)

    # HOJA 2: ESTADOS

    hoja_estados = libro.create_sheet("Estados")

    agregar_fila(
        hoja_estados,
        ["Estado", "Cantidad", "Porcentaje"],
    )

    porcentajes_estado = datos.get(
        "porcentaje_estado", {}
    )

    for estado in (
        "ACTIVO",
        "CONTROLADO",
        "EXTINGUIDO",
        "CERRADO",
    ):
        agregar_fila(hoja_estados, [
            estado,
            estados.get(estado, 0),
            porcentajes_estado.get(estado, 0) / 100,
        ])

        hoja_estados.cell(
            hoja_estados.max_row, 3
        ).number_format = FORMATO_PORCENTAJE

    aplicar_estilos(hoja_estados)
    agregar_grafico_circular(hoja_estados)

    # HOJA 3: GRAVEDAD

    hoja_gravedad = libro.create_sheet("Gravedad")

    agregar_fila(
        hoja_gravedad,
        ["Gravedad", "Cantidad", "Porcentaje"],
    )

    porcentajes_gravedad = datos.get(
        "porcentaje_gravedad", {}
    )

    for gravedad in (
        "BAJA",
        "MEDIA",
        "ALTA",
        "CATASTROFICA",
    ):
        agregar_fila(hoja_gravedad, [
            gravedad,
            gravedades.get(gravedad, 0),
            porcentajes_gravedad.get(gravedad, 0) / 100,
        ])

        hoja_gravedad.cell(
            hoja_gravedad.max_row, 3
        ).number_format = FORMATO_PORCENTAJE

    aplicar_estilos(hoja_gravedad)

    agregar_grafico_barras(
        hoja_gravedad,
        "Incidentes por gravedad",
    )

    # HOJA 4: ZONAS

    hoja_zonas = libro.create_sheet("Zonas")

    agregar_fila(hoja_zonas, [
        "Zona",
        "Cantidad",
        "Nivel de riesgo",
        "Porcentaje",
        "ID de zona",
    ])

    for zona in datos.get("por_zona", []):
        agregar_fila(hoja_zonas, [
            zona["nombre"],
            zona["cantidad"],
            zona.get("nivel_riesgo") or "Sin asignar",
            zona["porcentaje"] / 100,
            zona.get("id_zona"),
        ])

        hoja_zonas.cell(
            hoja_zonas.max_row, 4
        ).number_format = FORMATO_PORCENTAJE

    aplicar_estilos(hoja_zonas)

    hoja_zonas.auto_filter.ref = hoja_zonas.dimensions

    agregar_grafico_barras(
        hoja_zonas,
        "Frecuencia de incidentes por zona",
        "G2",
    )

    # HOJA 5: DANOS

    hoja_danos = libro.create_sheet("Daños")

    agregar_fila(
        hoja_danos,
        ["Nivel de daño", "Cantidad"],
    )

    niveles = danos.get("por_nivel", {})

    for nivel in (
        "LEVE",
        "MODERADO",
        "SEVERO",
        "TOTAL",
    ):
        agregar_fila(hoja_danos, [
            nivel,
            niveles.get(nivel, 0),
        ])

    agregar_grafico_barras(
        hoja_danos,
        "Evaluaciones por nivel de daño",
    )

    agregar_fila(hoja_danos, [
        "Total de evaluaciones",
        danos.get("total_evaluaciones", 0),
    ])

    agregar_fila(hoja_danos, [
        "Costo total estimado",
        danos.get("costo_total_estimado", 0),
    ])

    hoja_danos.cell(
        hoja_danos.max_row, 2
    ).number_format = FORMATO_MONEDA

    aplicar_estilos(hoja_danos)

    # HOJA 6: FILTROS

    hoja_filtros = libro.create_sheet("Filtros")

    filas_filtros = [
        ["Filtro", "Valor"],
        ["Fecha inicial",
         filtros.get("fecha_inicio") or "Sin límite"],
        ["Fecha final",
         filtros.get("fecha_fin") or "Sin límite"],
        ["ID de zona",
         filtros.get("id_zona") or "Todas"],
        ["Nivel de riesgo",
         filtros.get("nivel_riesgo") or "Todos"],
    ]

    for fila in filas_filtros:
        agregar_fila(hoja_filtros, fila)

    aplicar_estilos(hoja_filtros)

    # GENERAR ARCHIVO EN MEMORIA

    buffer = BytesIO()

    libro.save(buffer)

    contenido = buffer.getvalue()

    buffer.close()
    libro.close()

    return contenido