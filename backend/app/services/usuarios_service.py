import re

from sqlalchemy.exc import IntegrityError

from app.config.database import db
from app.models.usuario import Persona, Rol, Usuario
from app.utils.errores import ErrorApp
from app.utils.security import hash_contrasena, verificar_contrasena

ROLES = ("ADMINISTRADOR", "OPERADOR", "BOMBERO", "CIUDADANO")
ESTADOS = ("ACTIVO", "INACTIVO", "BLOQUEADO")
USUARIO_RE = re.compile(r"^[A-Za-z0-9_]{3,50}$")
CORREO_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _texto(data, campo, obligatorio=True, maximo=100):
    valor = data.get(campo, "")
    if valor is None:
        valor = ""
    if not isinstance(valor, str):
        raise ErrorApp(f"{campo} debe ser texto")
    valor = valor.strip()
    if obligatorio and not valor:
        raise ErrorApp(f"{campo} es obligatorio")
    if len(valor) > maximo:
        raise ErrorApp(f"{campo} admite como máximo {maximo} caracteres")
    return valor or None


def validar_contrasena(contrasena):
    if not isinstance(contrasena, str) or contrasena.strip() == "":
        raise ErrorApp("La contraseña es obligatoria")
    if len(contrasena) > 128:
        raise ErrorApp("La contraseña admite como máximo 128 caracteres")
    tiene_mayuscula = any(caracter.isupper() for caracter in contrasena)
    tiene_numero = any(caracter.isdigit() for caracter in contrasena)
    tiene_especial = any(not caracter.isalnum() for caracter in contrasena)
    if len(contrasena) < 8 or not tiene_mayuscula or not tiene_numero or not tiene_especial:
        raise ErrorApp(
            "La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial"
        )


def validar_correo(correo):
    if not isinstance(correo, str):
        raise ErrorApp("El correo debe ser texto")
    correo = correo.strip().lower()
    if not correo:
        raise ErrorApp("El correo es obligatorio")
    if len(correo) > 255 or not CORREO_RE.fullmatch(correo):
        raise ErrorApp("El correo no es válido")
    return correo


def _correo_libre(correo, id_persona=None):
    consulta = Persona.query.filter(db.func.lower(Persona.correo) == correo)
    if id_persona is not None:
        consulta = consulta.filter(Persona.id_persona != id_persona)
    if consulta.first():
        raise ErrorApp("Ese correo ya está registrado", 409)


def validar_nombre_usuario(nombre):
    if not isinstance(nombre, str) or not USUARIO_RE.fullmatch(nombre.strip()):
        raise ErrorApp(
            "El usuario debe tener entre 3 y 50 caracteres: letras, números o _"
        )
    return nombre.strip()


def _rol_por_nombre(nombre_rol):
    if not isinstance(nombre_rol, str):
        raise ErrorApp("El rol no es válido")
    nombre_rol = nombre_rol.strip()
    if nombre_rol not in ROLES:
        raise ErrorApp("El rol no es válido")
    rol = Rol.query.filter_by(nombre_rol=nombre_rol).first()
    if rol is None:
        raise ErrorApp("Ese rol no existe en el sistema", 500)
    return rol


def crear_usuario(data, rol_nombre):
    nombres = _texto(data, "nombres", maximo=100)
    apellidos = _texto(data, "apellidos", maximo=100)
    telefono = _texto(data, "telefono", obligatorio=False, maximo=20)
    correo = validar_correo(data.get("correo", ""))
    direccion = _texto(data, "direccion", obligatorio=False, maximo=255)
    nombre_usuario = validar_nombre_usuario(data.get("nombre_usuario", ""))
    _correo_libre(correo)
    contrasena = data.get("contrasena")
    validar_contrasena(contrasena)
    rol = _rol_por_nombre(rol_nombre)

    if Usuario.query.filter_by(nombre_usuario=nombre_usuario).first():
        raise ErrorApp("Ese nombre de usuario ya existe", 409)

    persona = Persona(
        nombres=nombres,
        apellidos=apellidos,
        telefono=telefono,
        correo=correo,
        direccion=direccion,
        tipo_persona=rol.nombre_rol,
    )
    db.session.add(persona)
    db.session.flush()
    usuario = Usuario(
        id_persona=persona.id_persona,
        id_rol=rol.id_rol,
        nombre_usuario=nombre_usuario,
        hash_contrasena=hash_contrasena(contrasena),
        estado="ACTIVO",
    )
    db.session.add(usuario)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ErrorApp("Ese nombre de usuario ya existe", 409)
    return usuario


def buscar_por_correo(correo):
    if not isinstance(correo, str):
        return None
    correo = correo.strip().lower()
    if not correo:
        return None
    return (
        Usuario.query.join(Persona)
        .filter(db.func.lower(Persona.correo) == correo)
        .first()
    )


def buscar_por_nombre(nombre_usuario):
    if not isinstance(nombre_usuario, str):
        return None
    return Usuario.query.filter_by(nombre_usuario=nombre_usuario.strip()).first()


def contrasena_correcta(usuario, contrasena):
    if not isinstance(contrasena, str) or not contrasena:
        return False
    if usuario is None:
        verificar_contrasena(
            "scrypt:32768:8:1$comparacion$dW5oYXNoLXBhcmEtdGllbXBv",
            contrasena,
        )
        return False
    return verificar_contrasena(usuario.hash_contrasena, contrasena)


def exigir_activo(usuario):
    if usuario.estado != "ACTIVO":
        raise ErrorApp("La cuenta no está activa", 403)


def cambiar_hash(usuario, contrasena_nueva):
    validar_contrasena(contrasena_nueva)
    usuario.hash_contrasena = hash_contrasena(contrasena_nueva)
    db.session.commit()


def listar_usuarios():
    return Usuario.query.order_by(Usuario.id_usuario).all()


def actualizar_usuario(actor, id_usuario, data):
    usuario = db.session.get(Usuario, id_usuario)
    if usuario is None:
        raise ErrorApp("Usuario no encontrado", 404)

    nombres = _texto(data, "nombres", maximo=100)
    apellidos = _texto(data, "apellidos", maximo=100)
    correo = validar_correo(data.get("correo", ""))
    nombre_usuario = validar_nombre_usuario(data.get("nombre_usuario", ""))
    _correo_libre(correo, usuario.id_persona)
    rol = _rol_por_nombre(data.get("rol"))
    estado = data.get("estado")
    if estado not in ESTADOS:
        raise ErrorApp("El estado no es válido")

    if usuario.id_usuario == actor.id_usuario:
        if estado != usuario.estado:
            raise ErrorApp("No puedes cambiar el estado de tu propia cuenta")
        if rol.id_rol != usuario.id_rol:
            raise ErrorApp("No puedes cambiar el rol de tu propia cuenta")

    ocupado = Usuario.query.filter_by(nombre_usuario=nombre_usuario).first()
    if ocupado is not None and ocupado.id_usuario != usuario.id_usuario:
        raise ErrorApp("Ese nombre de usuario ya existe", 409)

    contrasena = data.get("contrasena", "")
    if contrasena is None:
        contrasena = ""
    if not isinstance(contrasena, str):
        raise ErrorApp("La contraseña debe ser texto")
    cambia_clave = contrasena.strip() != ""
    if cambia_clave:
        validar_contrasena(contrasena)
        usuario.hash_contrasena = hash_contrasena(contrasena)

    usuario.persona.nombres = nombres
    usuario.persona.apellidos = apellidos
    usuario.persona.correo = correo
    usuario.persona.tipo_persona = rol.nombre_rol
    usuario.persona.updated_at = db.func.now()
    usuario.nombre_usuario = nombre_usuario
    usuario.id_rol = rol.id_rol
    usuario.rol = rol
    usuario.estado = estado
    usuario.updated_at = db.func.now()

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ErrorApp("Ese nombre de usuario ya existe", 409)
    db.session.refresh(usuario)
    return usuario, cambia_clave and usuario.id_usuario == actor.id_usuario


def cambiar_estado(actor, id_usuario, estado):
    if estado not in ESTADOS:
        raise ErrorApp("El estado no es válido")
    usuario = db.session.get(Usuario, id_usuario)
    if usuario is None:
        raise ErrorApp("Usuario no encontrado", 404)
    if usuario.id_usuario == actor.id_usuario:
        raise ErrorApp("No puedes cambiar el estado de tu propia cuenta")
    usuario.estado = estado
    db.session.commit()
    return usuario
