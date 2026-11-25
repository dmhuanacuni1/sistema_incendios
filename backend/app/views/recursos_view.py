"""Serialización de estaciones, unidades y recursos (contrato de vista)."""


def _fecha(valor):
    return valor.isoformat() if valor is not None else None


def estacion_a_dict(estacion):
    return {
        "id_estacion": estacion.id_estacion,
        "nombre": estacion.nombre,
        "direccion": estacion.direccion,
        "telefono": estacion.telefono,
        "tiene_foto": bool(getattr(estacion, "tiene_foto", False)),
        "estado": getattr(estacion, "estado", "ACTIVA") or "ACTIVA",
        "activo": (getattr(estacion, "estado", "ACTIVA") or "ACTIVA") == "ACTIVA",
        "motivo_baja": getattr(estacion, "motivo_baja", None),
        "fecha_baja": _fecha(getattr(estacion, "fecha_baja", None)),
        "id_administrador": estacion.id_administrador,
        "created_at": _fecha(estacion.created_at),
        "updated_at": _fecha(estacion.updated_at),
        "unidades": [],
        "recursos": [],
    }


def unidad_a_dict(unidad, estacion=None):
    return {
        "categoria": "UNIDAD",
        "id": unidad.id_unidad,
        "id_unidad": unidad.id_unidad,
        "identificador": unidad.codigo,
        "codigo": unidad.codigo,
        "nombre": None,
        "tipo": unidad.tipo,
        "tipo_recurso": None,
        "capacidad": unidad.capacidad,
        "cantidad": None,
        "estado": unidad.estado,
        "motivo_estado": unidad.motivo_estado,
        "id_estacion": unidad.id_estacion,
        "estacion": estacion.nombre if estacion is not None else None,
        "id_administrador": unidad.id_administrador,
        "created_at": _fecha(unidad.created_at),
        "updated_at": _fecha(unidad.updated_at),
    }


def recurso_a_dict(recurso, estacion=None):
    return {
        "categoria": "RECURSO",
        "id": recurso.id_recurso,
        "id_recurso": recurso.id_recurso,
        "identificador": recurso.nombre,
        "codigo": None,
        "nombre": recurso.nombre,
        "tipo": recurso.tipo_recurso,
        "tipo_recurso": recurso.tipo_recurso,
        "capacidad": None,
        "cantidad": recurso.cantidad,
        "estado": recurso.estado,
        "motivo_estado": recurso.motivo_estado,
        "id_estacion": recurso.id_estacion,
        "estacion": estacion.nombre if estacion is not None else None,
        "id_administrador": recurso.id_administrador,
        "created_at": _fecha(recurso.created_at),
        "updated_at": _fecha(recurso.updated_at),
    }

