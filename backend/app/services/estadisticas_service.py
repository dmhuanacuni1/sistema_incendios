from datetime import datetime, timedelta, timezone
from sqlalchemy import func

from app.config.database import db

from app.models.incidente import (
    Incidente,
    ESTADOS_INCIDENTE,
    GRAVEDADES_INCIDENTE
)

from app.models.zona_riesgo import ZonaRiesgo

from app.models.evaluacion_dano import (
    EvaluacionDano,
    NIVELES_DANO
)


# Zona horaria de Bolivia
ZONA_HORARIA = timezone(timedelta(hours=-4))


def convertir_fecha(fecha):
    try:
        return datetime.strptime(
            fecha, "%Y-%m-%d"
        ).replace(tzinfo=ZONA_HORARIA)
    except (ValueError, TypeError):
        raise ValueError(
            "La fecha debe tener el formato YYYY-MM-DD"
        )


def calcular_porcentajes(datos, total):
    return {
        clave: round(cantidad / total * 100, 2)
        if total > 0 else 0
        for clave, cantidad in datos.items()
    }


def obtener_estadisticas(
    fecha_inicio=None,
    fecha_fin=None,
    id_zona=None,
    nivel_riesgo=None
):

    # Validacion de fechas
    inicio = convertir_fecha(fecha_inicio) if fecha_inicio else None
    fin = convertir_fecha(fecha_fin) if fecha_fin else None

    if inicio and fin and inicio > fin:
        raise ValueError(
            "La fecha de inicio no puede ser mayor a la fecha final"
        )

    # Consulta base
    consulta = db.session.query(Incidente)

    # Filtro por fecha inicial
    if inicio:
        consulta = consulta.filter(
            Incidente.fecha_inicio >= inicio
        )

    # Filtro por fecha final inclusiva
    if fin:
        consulta = consulta.filter(
            Incidente.fecha_inicio < fin + timedelta(days=1)
        )

    # Filtro por zona
    if id_zona is not None:
        consulta = consulta.filter(
            Incidente.id_zona == id_zona
        )

    # Filtro por nivel de riesgo
    if nivel_riesgo:
        nivel_riesgo = nivel_riesgo.upper()

        if nivel_riesgo not in ZonaRiesgo.NIVELES_VALIDOS:
            raise ValueError("Nivel de riesgo no valido")

        consulta = consulta.join(
            ZonaRiesgo,
            Incidente.id_zona == ZonaRiesgo.id_zona
        ).filter(
            ZonaRiesgo.nivel_riesgo == nivel_riesgo
        )

    # Total de incidentes
    total = consulta.count()

    # Distribucion por estado
    estados = {
        estado: 0 for estado in ESTADOS_INCIDENTE
    }

    resultados_estado = consulta.with_entities(
        Incidente.estado,
        func.count(Incidente.id_incidente)
    ).group_by(
        Incidente.estado
    ).all()

    for estado, cantidad in resultados_estado:
        estados[estado] = cantidad

    # Distribucion por gravedad
    gravedades = {
        gravedad: 0 for gravedad in GRAVEDADES_INCIDENTE
    }

    resultados_gravedad = consulta.with_entities(
        Incidente.gravedad,
        func.count(Incidente.id_incidente)
    ).group_by(
        Incidente.gravedad
    ).all()

    for gravedad, cantidad in resultados_gravedad:
        gravedades[gravedad] = cantidad

    # Incidentes filtrados
    incidentes_filtrados = consulta.with_entities(
        Incidente.id_incidente,
        Incidente.id_zona,
        Incidente.fecha_inicio,
        Incidente.fecha_cierre
    ).subquery()

    # Frecuencia por zona
    resultados_zonas = db.session.query(
        incidentes_filtrados.c.id_zona,
        ZonaRiesgo.nombre,
        ZonaRiesgo.nivel_riesgo,
        func.count(
            incidentes_filtrados.c.id_incidente
        )
    ).outerjoin(
        ZonaRiesgo,
        incidentes_filtrados.c.id_zona == ZonaRiesgo.id_zona
    ).group_by(
        incidentes_filtrados.c.id_zona,
        ZonaRiesgo.nombre,
        ZonaRiesgo.nivel_riesgo
    ).order_by(
        func.count(
            incidentes_filtrados.c.id_incidente
        ).desc()
    ).all()

    zonas = []

    for zona_id, nombre, riesgo, cantidad in resultados_zonas:
        zonas.append({
            "id_zona": zona_id,
            "nombre": nombre or "Sin zona asignada",
            "nivel_riesgo": riesgo,
            "cantidad": cantidad,
            "porcentaje": round(
                cantidad / total * 100, 2
            ) if total > 0 else 0
        })

    # Tiempo promedio de cierre en horas
    duracion = db.session.query(
        func.avg(
            func.extract(
                "epoch",
                incidentes_filtrados.c.fecha_cierre -
                incidentes_filtrados.c.fecha_inicio
            ) / 3600
        )
    ).filter(
        incidentes_filtrados.c.fecha_cierre.isnot(None),
        incidentes_filtrados.c.fecha_inicio.isnot(None),
        incidentes_filtrados.c.fecha_cierre >=
        incidentes_filtrados.c.fecha_inicio
    ).scalar()

    # Consulta de evaluaciones de danos
    consulta_danos = db.session.query(
        EvaluacionDano
    ).join(
        incidentes_filtrados,
        EvaluacionDano.id_incidente ==
        incidentes_filtrados.c.id_incidente
    )

    total_evaluaciones = consulta_danos.count()

    costo_total = consulta_danos.with_entities(
        func.sum(EvaluacionDano.costo_estimado)
    ).scalar() or 0

    # Distribucion por nivel de dano
    niveles_dano = {
        nivel: 0 for nivel in NIVELES_DANO
    }

    resultados_danos = consulta_danos.with_entities(
        EvaluacionDano.nivel_dano,
        func.count(EvaluacionDano.id_evaluacion)
    ).group_by(
        EvaluacionDano.nivel_dano
    ).all()

    for nivel, cantidad in resultados_danos:
        niveles_dano[nivel] = cantidad

    # Resultado final
    return {
        "filtros": {
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "id_zona": id_zona,
            "nivel_riesgo": nivel_riesgo
        },
        "total_incidentes": total,
        "por_estado": estados,
        "por_gravedad": gravedades,
        "porcentaje_estado": calcular_porcentajes(
            estados, total
        ),
        "porcentaje_gravedad": calcular_porcentajes(
            gravedades, total
        ),
        "porcentaje_cerrados": round(
            estados["CERRADO"] / total * 100, 2
        ) if total > 0 else 0,
        "por_zona": zonas,
        "tiempo_promedio_cierre_horas": round(
            float(duracion), 2
        ) if duracion is not None else None,
        "danos": {
            "total_evaluaciones": total_evaluaciones,
            "costo_total_estimado": float(costo_total),
            "por_nivel": niveles_dano
        },
        "sin_datos": total == 0
    }
