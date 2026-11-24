"""Reglas de negocio de la iteración 3: gestión de brigadas.

Trabaja sobre las tablas físicas `brigadas` y `brigada_miembros`. La tabla
`incidente_brigadas` pertenece a la iteración 5 (Incidentes): aquí solo se lee
y se cambia `estado_asignacion` al confirmar la recepción, sin crear filas.

Los estados son los valores exactos de los CHECK de la base de datos:
- brigadas.estado: ACTIVA, EN_OPERACION, DESCANSO, DISUELTA
- brigada_miembros.estado: ACTIVO, INACTIVO, PENDIENTE, RECHAZADA
- incidente_brigadas.estado_asignacion: ASIGNADA, EN_CAMINO, EN_SITIO, LIBERADA
"""

import re
import unicodedata
from datetime import date

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config.database import db
from app.models.brigada import Brigada, BrigadaMiembro, NotificacionBrigada
from app.models.estacion import Estacion
from app.models.usuario import Persona, Usuario
from app.views.brigadas_view import (
    bombero_a_dict,
    brigada_a_dict,
    miembro_a_dict,
    notificacion_a_dict,
)

ESTADOS_BRIGADA = ("ACTIVA", "EN_OPERACION", "DESCANSO", "DISUELTA")
ROLES_BRIGADA = ("JEFE_CUADRILLA", "BOMBERO", "ESPECIALISTA", "PARAMEDICO")
ESTADOS_MIEMBRO = ("ACTIVO", "INACTIVO", "PENDIENTE", "RECHAZADA")
ESTADOS_NOTIFICACION = ("PENDIENTE", "ACEPTADA", "RECHAZADA")
ESTADOS_CON_MOTIVO = ("DESCANSO", "DISUELTA")
ASIGNACIONES_ACTIVAS = ("ASIGNADA", "EN_CAMINO", "EN_SITIO")
MAX_MOTIVO = 500


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


def normalizar_estado(valor, permitidos=ESTADOS_BRIGADA):
    """Acepta códigos de la BD y etiquetas legibles de la interfaz."""
    if valor is None or not str(valor).strip():
        raise ErrorModulo("Estado: es obligatorio", "estado")
    plano = unicodedata.normalize("NFKD", str(valor)).encode("ascii", "ignore").decode()
    codigo = re.sub(r"[\s\-]+", "_", plano.strip()).strip("_").upper()
    alias = {
        "ACTIVO": "ACTIVA",
        "OPERATIVA": "ACTIVA",
        "EN_SERVICIO": "EN_OPERACION",
        "EN_OPERACION": "EN_OPERACION",
        "DE_BAJA": "DISUELTA",
        "INACTIVA": "DISUELTA",
        "DISUELTO": "DISUELTA",
    }
    codigo = alias.get(codigo, codigo)
    if codigo not in permitidos:
        raise ErrorModulo("Estado: no es un estado válido para una brigada", "estado")
    return codigo


def normalizar_rol(valor):
    if valor is None or not str(valor).strip():
        raise ErrorModulo("Rol en la brigada: es obligatorio", "rol_en_brigada")
    plano = unicodedata.normalize("NFKD", str(valor)).encode("ascii", "ignore").decode()
    codigo = re.sub(r"[\s\-]+", "_", plano.strip()).strip("_").upper()
    alias = {"JEFE": "JEFE_CUADRILLA", "BOMBERO": "BOMBERO"}
    codigo = alias.get(codigo, codigo)
    if codigo not in ROLES_BRIGADA:
        raise ErrorModulo("Rol en la brigada: no es un rol válido", "rol_en_brigada")
    return codigo


def _motivo(data, estado, estado_anterior=None):
    valor = data.get("motivo", "")
    if valor is None:
        valor = ""
    if not isinstance(valor, str):
        raise ErrorModulo("Motivo: debe ser texto", "motivo")
    valor = valor.strip()
    if len(valor) > MAX_MOTIVO:
        raise ErrorModulo(f"Motivo: admite como máximo {MAX_MOTIVO} caracteres", "motivo")
    obligatorio = estado in ESTADOS_CON_MOTIVO or (
        estado_anterior in ESTADOS_CON_MOTIVO and estado != estado_anterior
    )
    if obligatorio and not valor:
        raise ErrorModulo("Motivo: es obligatorio para este cambio de estado", "motivo")
    return valor or None


def _cupo(data, ocupados_actuales=0):
    """Valida min_integrantes / max_integrantes de una brigada."""
    def numero(campo, etiqueta, defecto):
        valor = data.get(campo, defecto)
        if valor is None or (isinstance(valor, str) and not valor.strip()):
            return defecto
        if isinstance(valor, bool):
            raise ErrorModulo(f"{etiqueta}: debe ser un número entero", campo)
        try:
            return int(valor)
        except (TypeError, ValueError):
            raise ErrorModulo(f"{etiqueta}: debe ser un número entero", campo)

    minimo = numero("min_integrantes", "Mínimo de integrantes", 5)
    maximo = numero("max_integrantes", "Máximo de integrantes", 10)
    if minimo < 5:
        raise ErrorModulo(
            "Mínimo: una cuadrilla operativa necesita al menos 5 integrantes",
            "min_integrantes",
        )
    if maximo > 10:
        raise ErrorModulo("Máximo: una cuadrilla admite hasta 10 integrantes", "max_integrantes")
    if maximo < minimo:
        raise ErrorModulo("Máximo: debe ser mayor o igual al mínimo", "max_integrantes")
    if maximo < ocupados_actuales:
        raise ErrorModulo(
            f"Máximo: no puede ser menor a los {ocupados_actuales} integrantes actuales",
            "max_integrantes",
        )
    return minimo, maximo


def _cupo_ocupado(id_brigada):
    total = db.session.execute(
        text(
            "select count(*) from brigada_miembros "
            "where id_brigada = :id and estado in ('ACTIVO', 'PENDIENTE')"
        ),
        {"id": id_brigada},
    ).scalar_one()
    return total


def _brigada_desde(id_brigada):
    brigada = db.session.get(Brigada, id_brigada)
    if brigada is None:
        raise ErrorModulo("La brigada no existe", codigo=404)
    return brigada


def _estacion_desde(data):
    valor = data.get("id_estacion")
    try:
        id_estacion = int(valor)
    except (TypeError, ValueError):
        raise ErrorModulo("Estación: selecciona una estación válida", "id_estacion")
    estacion = db.session.get(Estacion, id_estacion)
    if estacion is None:
        raise ErrorModulo("Estación: la estación seleccionada no existe", "id_estacion")
    return estacion


def _tiene_asignacion_activa(id_brigada):
    total = db.session.execute(
        text(
            "select count(*) from incidente_brigadas "
            "where id_brigada = :id and estado_asignacion in "
            "('ASIGNADA', 'EN_CAMINO', 'EN_SITIO')"
        ),
        {"id": id_brigada},
    ).scalar_one()
    return total > 0


def _total_miembros(id_brigada):
    return BrigadaMiembro.query.filter_by(id_brigada=id_brigada, estado="ACTIVO").count()


def _motivo_no_disponible(brigada, total):
    if brigada.estado != "ACTIVA":
        return f"Estado {brigada.estado}, no está activa"
    if total < brigada.min_integrantes:
        return (
            f"Faltan {brigada.min_integrantes - total} integrantes "
            f"(mínimo {brigada.min_integrantes})"
        )
    if _tiene_asignacion_activa(brigada.id_brigada):
        return "Tiene una asignación de incidente abierta"
    return None


def _es_disponible(brigada, total):
    return (
        brigada.estado == "ACTIVA"
        and total >= brigada.min_integrantes
        and not _tiene_asignacion_activa(brigada.id_brigada)
    )


def _serializar(brigada, estacion=None):
    total = _total_miembros(brigada.id_brigada)
    disponible = _es_disponible(brigada, total)
    return brigada_a_dict(
        brigada,
        estacion=estacion,
        total_miembros=total,
        disponible=disponible,
        motivo_no_disponible=None if disponible else _motivo_no_disponible(brigada, total),
    )


def listar_brigadas(estado=None, disponibilidad=None, orden=None):
    """CU-05 / CU-13: listado con estado, estación y disponibilidad derivada."""
    consulta = Brigada.query
    filtro_estado = None
    if estado is not None and str(estado).strip():
        filtro_estado = normalizar_estado(estado)
        consulta = consulta.filter_by(estado=filtro_estado)

    filtro_disponibilidad = None
    if disponibilidad is not None and str(disponibilidad).strip():
        filtro_disponibilidad = (
            unicodedata.normalize("NFKD", str(disponibilidad))
            .encode("ascii", "ignore")
            .decode()
            .strip()
            .upper()
        )
        if filtro_disponibilidad not in ("DISPONIBLE", "NO_DISPONIBLE"):
            raise ErrorModulo(
                "Disponibilidad: elige Disponible o No disponible", "disponibilidad"
            )

    brigadas = consulta.order_by(Brigada.nombre).all()
    if not brigadas:
        return []

    estaciones = {
        estacion.id_estacion: estacion
        for estacion in Estacion.query.filter(
            Estacion.id_estacion.in_([b.id_estacion for b in brigadas])
        ).all()
    }
    resultado = []
    for brigada in brigadas:
        item = _serializar(brigada, estaciones.get(brigada.id_estacion))
        if filtro_disponibilidad == "DISPONIBLE" and not item["disponible"]:
            continue
        if filtro_disponibilidad == "NO_DISPONIBLE" and item["disponible"]:
            continue
        resultado.append(item)

    criterio = str(orden or "").strip().lower() or "nombre_asc"
    if criterio == "nombre_desc":
        resultado.sort(key=lambda item: item["nombre"].lower(), reverse=True)
    elif criterio == "estado":
        resultado.sort(key=lambda item: (item["estado"], item["nombre"].lower()))
    elif criterio == "disponibilidad":
        resultado.sort(key=lambda item: (not item["disponible"], item["nombre"].lower()))
    else:
        resultado.sort(key=lambda item: item["nombre"].lower())
    return resultado


def consultar(estado=None, disponibilidad=None, orden=None):
    """CU-05: alias usado por la pantalla de consulta detallada."""
    return listar_brigadas(
        estado=estado, disponibilidad=disponibilidad, orden=orden
    )


def consultar_disponibilidad():
    """CU-13: solo brigadas ACTIVAS sin asignación abierta.

    La disponibilidad NO se guarda en una columna: se deriva del estado y de
    `incidente_brigadas`, para que nunca se desincronice.
    """
    return listar_brigadas(disponibilidad="DISPONIBLE")


def obtener_brigada(id_brigada):
    """Devuelve una brigada para cargar el formulario de edición."""
    brigada = _brigada_desde(id_brigada)
    return _serializar(brigada, db.session.get(Estacion, brigada.id_estacion))


def crear_brigada(data, usuario):
    """CU-01: alta de brigada ligada a una estación existente."""
    if not isinstance(data, dict):
        raise ErrorModulo("Los datos de la brigada no son válidos")

    nombre = texto(data, "nombre", "Nombre", 100)
    estacion = _estacion_desde(data)
    estado = normalizar_estado(data.get("estado") or "ACTIVA")
    motivo = _motivo(data, estado)
    minimo, maximo = _cupo(data)

    repetida = (
        Brigada.query.filter(db.func.lower(Brigada.nombre) == nombre.lower()).first()
    )
    if repetida is not None:
        raise ErrorModulo("Nombre: ya existe una brigada con ese nombre", "nombre")

    brigada = Brigada(
        nombre=nombre,
        estado=estado,
        motivo_estado=motivo,
        min_integrantes=minimo,
        max_integrantes=maximo,
        id_estacion=estacion.id_estacion,
    )
    db.session.add(brigada)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        raise ErrorModulo("No se pudo guardar la brigada. Intenta de nuevo", codigo=500)
    return _serializar(brigada, estacion)


def editar_brigada(id_brigada, data, usuario):
    """CU-02: editar nombre y estación de una brigada existente."""
    if not isinstance(data, dict):
        raise ErrorModulo("Los datos de la brigada no son válidos")
    brigada = _brigada_desde(id_brigada)
    nombre = texto(data, "nombre", "Nombre", 100)
    estacion = _estacion_desde(data)
    minimo, maximo = _cupo(data, _cupo_ocupado(id_brigada))

    repetida = (
        Brigada.query.filter(db.func.lower(Brigada.nombre) == nombre.lower())
        .filter(Brigada.id_brigada != id_brigada)
        .first()
    )
    if repetida is not None:
        raise ErrorModulo("Nombre: ya existe una brigada con ese nombre", "nombre")

    brigada.nombre = nombre
    brigada.id_estacion = estacion.id_estacion
    brigada.min_integrantes = minimo
    brigada.max_integrantes = maximo
    brigada.updated_at = db.func.now()
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        raise ErrorModulo("No se pudo actualizar la brigada. Intenta de nuevo", codigo=500)
    return _serializar(brigada, estacion)


def cambiar_estado(id_brigada, data, usuario):
    """CU-11: actualizar estado/disponibilidad, registrando el motivo."""
    brigada = _brigada_desde(id_brigada)
    if not isinstance(data, dict):
        raise ErrorModulo("Los datos del cambio no son válidos")
    estado = normalizar_estado(data.get("estado"))
    motivo = _motivo(data, estado, brigada.estado)

    brigada.estado = estado
    brigada.motivo_estado = motivo
    brigada.updated_at = db.func.now()
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        raise ErrorModulo("No se pudo actualizar el estado. Intenta de nuevo", codigo=500)
    resultado = _serializar(brigada)
    resultado["modificado_por"] = usuario.nombre_usuario
    return resultado


def desactivar_brigada(id_brigada, data, usuario):
    """CU-03: baja lógica de la brigada (estado DISUELTA)."""
    datos = dict(data) if isinstance(data, dict) else {}
    datos["estado"] = "DISUELTA"
    return cambiar_estado(id_brigada, datos, usuario)


def reactivar_brigada(id_brigada, data, usuario):
    """CU-04: reactivar una brigada dada de baja (estado ACTIVA)."""
    datos = dict(data) if isinstance(data, dict) else {}
    datos["estado"] = "ACTIVA"
    if not str(datos.get("motivo") or "").strip():
        datos["motivo"] = "Reactivación de la brigada"
    return cambiar_estado(id_brigada, datos, usuario)


def mis_notificaciones(usuario):
    """Invitaciones entregadas al bombero en sesión, con su respuesta."""
    notificaciones = (
        NotificacionBrigada.query.filter_by(id_persona=usuario.persona.id_persona)
        .order_by(NotificacionBrigada.fecha_creacion.desc())
        .all()
    )
    if not notificaciones:
        return []
    ids = [n.id_brigada for n in notificaciones]
    brigadas = {
        b.id_brigada: b
        for b in Brigada.query.filter(Brigada.id_brigada.in_(ids)).all()
    }
    return [
        notificacion_a_dict(n, brigadas.get(n.id_brigada)) for n in notificaciones
    ]


def responder_notificacion(id_notificacion, data, usuario):
    """CU-16: el bombero acepta o rechaza la invitación a una brigada."""
    notificacion = db.session.get(NotificacionBrigada, id_notificacion)
    if notificacion is None:
        raise ErrorModulo("La notificación no existe", codigo=404)
    if notificacion.id_persona != usuario.persona.id_persona:
        raise ErrorModulo("Esta notificación no te pertenece", codigo=403)
    if notificacion.estado != "PENDIENTE":
        raise ErrorModulo("La notificación ya fue respondida", "estado")
    if not isinstance(data, dict):
        raise ErrorModulo("Los datos de la respuesta no son válidos")

    respuesta = str(data.get("respuesta", "")).strip().upper()
    if respuesta not in ("ACEPTAR", "RECHAZAR"):
        raise ErrorModulo("Respuesta: elige ACEPTAR o RECHAZAR", "respuesta")

    motivo = data.get("motivo") or ""
    if not isinstance(motivo, str):
        raise ErrorModulo("Motivo: debe ser texto", "motivo")
    motivo = motivo.strip()
    if len(motivo) > MAX_MOTIVO:
        raise ErrorModulo(f"Motivo: admite como máximo {MAX_MOTIVO} caracteres", "motivo")
    if respuesta == "RECHAZAR" and not motivo:
        raise ErrorModulo("Motivo: es obligatorio cuando rechazas una invitación", "motivo")

    integrante = BrigadaMiembro.query.filter_by(
        id_brigada=notificacion.id_brigada, id_persona=notificacion.id_persona
    ).first()
    if integrante is None:
        raise ErrorModulo("La invitación ya no existe", codigo=404)

    if respuesta == "ACEPTAR":
        otra = db.session.execute(
            text(
                "select id_brigada from brigada_miembros "
                "where id_persona = :persona and estado = 'ACTIVO' "
                "and id_brigada <> :brigada"
            ),
            {"persona": notificacion.id_persona, "brigada": notificacion.id_brigada},
        ).first()
        if otra is not None:
            raise ErrorModulo("Ya perteneces a otra brigada activa", codigo=409)
        integrante.estado = "ACTIVO"
        notificacion.estado = "ACEPTADA"
        mensaje = "Invitación aceptada: ahora eres integrante activo de la brigada"
    else:
        integrante.estado = "RECHAZADA"
        notificacion.estado = "RECHAZADA"
        notificacion.motivo_rechazo = motivo
        mensaje = "Invitación rechazada. Se registró tu motivo"

    notificacion.fecha_respuesta = db.func.now()
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        raise ErrorModulo("No se pudo registrar tu respuesta. Intenta de nuevo", codigo=500)

    brigada = db.session.get(Brigada, notificacion.id_brigada)
    return {
        "mensaje": f"{mensaje} · {brigada.nombre if brigada else ''}".strip(),
        "notificacion": notificacion_a_dict(notificacion, brigada),
        "estado_miembro": integrante.estado,
    }


def mis_brigadas(usuario):
    """Vista de solo lectura: brigadas activas a las que pertenece el bombero."""
    miembros = (
        BrigadaMiembro.query.filter_by(
            id_persona=usuario.persona.id_persona, estado="ACTIVO"
        )
        .order_by(BrigadaMiembro.fecha_incorporacion.desc())
        .all()
    )
    resultado = []
    for miembro in miembros:
        brigada = db.session.get(Brigada, miembro.id_brigada)
        if brigada is None:
            continue
        estacion = db.session.get(Estacion, brigada.id_estacion)
        resultado.append(
            {
                "id_brigada": brigada.id_brigada,
                "nombre": brigada.nombre,
                "estacion": estacion.nombre if estacion is not None else None,
                "rol_en_brigada": miembro.rol_en_brigada,
                "fecha_incorporacion": _fecha(miembro.fecha_incorporacion),
                "estado_brigada": brigada.estado,
                "disponible": _es_disponible(brigada, _total_miembros(brigada.id_brigada)),
            }
        )
    return resultado


def listar_miembros(id_brigada):
    """CU-06: integrantes de una brigada con su rol global y su rol interno."""
    _brigada_desde(id_brigada)
    miembros = (
        BrigadaMiembro.query.filter_by(id_brigada=id_brigada)
        .order_by(BrigadaMiembro.estado.asc(), BrigadaMiembro.id_brigada_miembro)
        .all()
    )
    if not miembros:
        return []

    ids_personas = [m.id_persona for m in miembros]
    personas = {
        p.id_persona: p
        for p in Persona.query.filter(Persona.id_persona.in_(ids_personas)).all()
    }
    usuarios = {
        u.id_persona: u
        for u in Usuario.query.filter(Usuario.id_persona.in_(ids_personas)).all()
    }
    resultado = []
    for miembro in miembros:
        usuario = usuarios.get(miembro.id_persona)
        resultado.append(
            miembro_a_dict(
                miembro,
                persona=personas.get(miembro.id_persona),
                nombre_usuario=usuario.nombre_usuario if usuario else None,
                rol_global=usuario.rol.nombre_rol if usuario else None,
            )
        )
    return resultado


def bomberos_disponibles():
    """CU-08: bomberos activos que no estén ya en otra brigada activa."""
    ocupados = {
        fila[0]
        for fila in db.session.execute(
            text(
                "select id_persona from brigada_miembros "
                "where estado in ('ACTIVO', 'PENDIENTE')"
            )
        ).fetchall()
    }
    candidatos = (
        Usuario.query.join(Usuario.rol)
        .filter(Usuario.rol.has(nombre_rol="BOMBERO"))
        .filter(Usuario.estado == "ACTIVO")
        .order_by(Usuario.nombre_usuario)
        .all()
    )
    resultado = [
        bombero_a_dict(usuario)
        for usuario in candidatos
        if usuario.persona.id_persona not in ocupados
    ]
    return sorted(resultado, key=lambda bombero: bombero["nombre"].lower())


def asignar_miembros(id_brigada, data, usuario):
    """CU-07: invitar bomberos y entregarles una notificación respondible."""
    brigada = _brigada_desde(id_brigada)
    if brigada.estado == "DISUELTA":
        raise ErrorModulo("No se pueden asignar bomberos a una brigada disuelta", "id_brigada")
    if not isinstance(data, dict):
        raise ErrorModulo("Los datos de la asignación no son válidos")

    miembros = data.get("miembros")
    if not isinstance(miembros, list) or not miembros:
        raise ErrorModulo("Selecciona al menos un bombero", "miembros")

    # Activas o pendientes bloquean una nueva invitación; rechazadas no.
    ocupados = {
        fila[0]: fila[1]
        for fila in db.session.execute(
            text(
                "select id_persona, id_brigada from brigada_miembros "
                "where estado in ('ACTIVO', 'PENDIENTE')"
            )
        ).fetchall()
    }
    invitaciones = []
    vistos = set()
    for item in miembros:
        if not isinstance(item, dict):
            raise ErrorModulo("La lista de bomberos no es válida", "miembros")
        try:
            id_persona = int(item.get("id_persona"))
        except (TypeError, ValueError):
            raise ErrorModulo("Selecciona un bombero válido", "miembros")
        if id_persona in vistos:
            raise ErrorModulo("Un bombero aparece repetido en la lista", "miembros")
        vistos.add(id_persona)

        candidato = Usuario.query.filter_by(id_persona=id_persona).first()
        if candidato is None or candidato.rol.nombre_rol != "BOMBERO":
            raise ErrorModulo("Solo se pueden asignar usuarios con rol BOMBERO", "miembros")
        if candidato.estado != "ACTIVO":
            raise ErrorModulo("El bombero seleccionado no está activo", "miembros")
        if ocupados.get(id_persona) == id_brigada:
            raise ErrorModulo(
                "El bombero ya está asignado o tiene una invitación pendiente en esta brigada",
                "miembros",
            )
        if id_persona in ocupados:
            raise ErrorModulo("El bombero ya está asignado a otra brigada activa", "miembros")

        rol = normalizar_rol(item.get("rol_en_brigada"))
        integrante = BrigadaMiembro.query.filter_by(
            id_brigada=id_brigada, id_persona=id_persona
        ).first()
        if integrante is not None:
            integrante.estado = "PENDIENTE"
            integrante.rol_en_brigada = rol
            integrante.fecha_incorporacion = date.today()
        else:
            integrante = BrigadaMiembro(
                id_brigada=id_brigada,
                id_persona=id_persona,
                rol_en_brigada=rol,
                fecha_incorporacion=date.today(),
                estado="PENDIENTE",
            )
            db.session.add(integrante)
        invitaciones.append((integrante, candidato, rol))
        ocupados[id_persona] = id_brigada

    if _cupo_ocupado(id_brigada) + len(invitaciones) > brigada.max_integrantes:
        raise ErrorModulo(
            f"Cupo: {brigada.nombre} admite como máximo "
            f"{brigada.max_integrantes} integrantes",
            "miembros",
        )

    etiqueta_rol = {
        "JEFE_CUADRILLA": "Jefe de cuadrilla",
        "BOMBERO": "Bombero",
        "ESPECIALISTA": "Especialista",
        "PARAMEDICO": "Paramédico",
    }
    try:
        db.session.flush()
        for integrante, candidato, rol in invitaciones:
            db.session.add(
                NotificacionBrigada(
                    id_brigada=id_brigada,
                    id_persona=integrante.id_persona,
                    mensaje=(
                        f"Fuiste invitado a formar parte de {brigada.nombre} "
                        f"como {etiqueta_rol.get(rol, rol)}. "
                        "Revisa la invitación y acepta o rechaza."
                    ),
                )
            )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        raise ErrorModulo("No se pudo enviar la invitación. Intenta de nuevo", codigo=500)

    ids = [i.id_persona for i, _, _ in invitaciones]
    usuarios_asignados = Usuario.query.filter(Usuario.id_persona.in_(ids)).all()
    por_persona = {u.id_persona: u for u in usuarios_asignados}
    return {
        "asignados": [
            miembro_a_dict(
                integrante,
                persona=por_persona[integrante.id_persona].persona,
                nombre_usuario=por_persona[integrante.id_persona].nombre_usuario,
                rol_global=por_persona[integrante.id_persona].rol.nombre_rol,
            )
            for integrante, _, _ in invitaciones
        ],
        "notificacion": {
            "canal": "interno",
            "estado": "PENDIENTE",
            "integrantes": len(usuarios_asignados),
            "nombres": [
                f"{u.persona.nombres} {u.persona.apellidos}".strip()
                for u in usuarios_asignados
            ],
        },
    }


def retirar_miembro(id_brigada, id_persona, usuario):
    """CU-10: baja lógica del integrante (estado INACTIVO)."""
    _brigada_desde(id_brigada)
    miembro = (
        BrigadaMiembro.query.filter_by(
            id_brigada=id_brigada, id_persona=id_persona, estado="ACTIVO"
        ).first()
    )
    if miembro is None:
        raise ErrorModulo("El integrante activo no existe en esta brigada", codigo=404)
    miembro.estado = "INACTIVO"
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        raise ErrorModulo("No se pudo retirar al integrante. Intenta de nuevo", codigo=500)
    return miembro_a_dict(miembro)


def _es_jefe_de(usuario, id_brigada):
    if usuario.rol.nombre_rol != "BOMBERO":
        return False
    id_persona = usuario.persona.id_persona
    return (
        BrigadaMiembro.query.filter_by(
            id_brigada=id_brigada,
            id_persona=id_persona,
            rol_en_brigada="JEFE_CUADRILLA",
            estado="ACTIVO",
        ).first()
        is not None
    )


def incendios_asignados(usuario):
    """CU-14: asignaciones de la brigada. Solo lectura de tablas de Incidentes."""
    sql = (
        "select ib.id_incidente, ib.id_brigada, ib.fecha_asignacion, "
        "ib.estado_asignacion, b.nombre as brigada, i.ubicacion, "
        "i.gravedad, i.estado as estado_incidente, i.fecha_inicio "
        "from incidente_brigadas ib "
        "join brigadas b on b.id_brigada = ib.id_brigada "
        "left join incidentes i on i.id_incidente = ib.id_incidente "
    )
    parametros = {}
    if usuario.rol.nombre_rol == "BOMBERO":
        sql += (
            "where exists (select 1 from brigada_miembros bm "
            "where bm.id_brigada = ib.id_brigada and bm.id_persona = :persona "
            "and bm.rol_en_brigada = 'JEFE_CUADRILLA' and bm.estado = 'ACTIVO') "
        )
        parametros["persona"] = usuario.persona.id_persona
    sql += "order by ib.fecha_asignacion desc"

    filas = db.session.execute(text(sql), parametros).mappings().all()
    return [
        {
            "id_incidente": fila["id_incidente"],
            "id_brigada": fila["id_brigada"],
            "brigada": fila["brigada"],
            "fecha_asignacion": _fecha(fila["fecha_asignacion"]),
            "estado_asignacion": fila["estado_asignacion"],
            "ubicacion": fila["ubicacion"],
            "gravedad": fila["gravedad"],
            "estado_incidente": fila["estado_incidente"],
            "fecha_inicio": _fecha(fila["fecha_inicio"]),
        }
        for fila in filas
    ]


def _fecha(valor):
    return valor.isoformat() if valor is not None else None


def confirmar_recepcion(id_incidente, id_brigada, usuario):
    """CU-15: el jefe de cuadrilla confirma; ASIGNADA -> EN_CAMINO.

    Se usa `EN_CAMINO` porque es el primer estado permitido por el CHECK de
    `incidente_brigadas` después de `ASIGNADA`; no se inventa un valor nuevo
    ni se modifica la columna (pertenece a la iteración 5).
    """
    if not _es_jefe_de(usuario, id_brigada):
        raise ErrorModulo(
            "Solo el jefe de cuadrilla de esta brigada puede confirmar la recepción",
            codigo=403,
        )

    brigada = db.session.get(Brigada, id_brigada)
    total = _total_miembros(id_brigada)
    if brigada is not None and total < brigada.min_integrantes:
        raise ErrorModulo(
            f"La brigada no cumple el mínimo de {brigada.min_integrantes} integrantes "
            f"({total} activos); no se puede confirmar la recepción",
            "integrantes",
            409,
        )

    fila = db.session.execute(
        text(
            "select estado_asignacion from incidente_brigadas "
            "where id_incidente = :incidente and id_brigada = :brigada"
        ),
        {"incidente": id_incidente, "brigada": id_brigada},
    ).first()
    if fila is None:
        raise ErrorModulo("La asignación no existe", codigo=404)

    estado = fila[0]
    if estado == "EN_CAMINO":
        return {
            "id_incidente": id_incidente,
            "id_brigada": id_brigada,
            "estado_asignacion": estado,
            "mensaje": "La asignación ya había sido confirmada",
        }
    if estado != "ASIGNADA":
        raise ErrorModulo(
            f"No se puede confirmar una asignación en estado {estado}", "estado_asignacion"
        )

    try:
        db.session.execute(
            text(
                "update incidente_brigadas set estado_asignacion = 'EN_CAMINO' "
                "where id_incidente = :incidente and id_brigada = :brigada"
            ),
            {"incidente": id_incidente, "brigada": id_brigada},
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        raise ErrorModulo("No se pudo confirmar la recepción. Intenta de nuevo", codigo=500)

    return {
        "id_incidente": id_incidente,
        "id_brigada": id_brigada,
        "estado_asignacion": "EN_CAMINO",
        "mensaje": "Recepción confirmada: la brigada quedó en camino",
    }
