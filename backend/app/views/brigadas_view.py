"""Serialización de brigadas, integrantes y asignaciones (contrato de vista)."""


def _fecha(valor):
    return valor.isoformat() if valor is not None else None


def brigada_a_dict(brigada, estacion=None, total_miembros=0, disponible=False):
    return {
        "id_brigada": brigada.id_brigada,
        "nombre": brigada.nombre,
        "estado": brigada.estado,
        "motivo_estado": brigada.motivo_estado,
        "min_integrantes": brigada.min_integrantes,
        "max_integrantes": brigada.max_integrantes,
        "id_estacion": brigada.id_estacion,
        "estacion": estacion.nombre if estacion is not None else None,
        "total_miembros": total_miembros,
        "disponible": bool(disponible),
        "created_at": _fecha(brigada.created_at),
        "updated_at": _fecha(brigada.updated_at),
    }


def miembro_a_dict(miembro, persona=None, nombre_usuario=None, rol_global=None):
    return {
        "id_brigada_miembro": miembro.id_brigada_miembro,
        "id_brigada": miembro.id_brigada,
        "id_persona": miembro.id_persona,
        "nombres": persona.nombres if persona is not None else None,
        "apellidos": persona.apellidos if persona is not None else None,
        "nombre_usuario": nombre_usuario,
        "rol_global": rol_global,
        "rol_en_brigada": miembro.rol_en_brigada,
        "fecha_incorporacion": _fecha(miembro.fecha_incorporacion),
        "estado": miembro.estado,
    }


def notificacion_a_dict(notificacion, brigada=None):
    return {
        "id_notificacion": notificacion.id_notificacion,
        "id_brigada": notificacion.id_brigada,
        "brigada": brigada.nombre if brigada is not None else None,
        "id_persona": notificacion.id_persona,
        "tipo": notificacion.tipo,
        "estado": notificacion.estado,
        "mensaje": notificacion.mensaje,
        "motivo_rechazo": notificacion.motivo_rechazo,
        "fecha_creacion": _fecha(notificacion.fecha_creacion),
        "fecha_respuesta": _fecha(notificacion.fecha_respuesta),
    }


def bombero_a_dict(usuario):
    persona = usuario.persona
    return {
        "id_usuario": usuario.id_usuario,
        "id_persona": persona.id_persona,
        "nombre": f"{persona.nombres} {persona.apellidos}".strip(),
        "nombre_usuario": usuario.nombre_usuario,
    }
