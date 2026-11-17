def usuario_a_dict(usuario):
    persona = usuario.persona
    return {
        "id_usuario": usuario.id_usuario,
        "nombre_usuario": usuario.nombre_usuario,
        "estado": usuario.estado,
        "rol": usuario.rol.nombre_rol,
        "persona": {
            "id_persona": persona.id_persona,
            "nombres": persona.nombres,
            "apellidos": persona.apellidos,
            "telefono": persona.telefono,
            "correo": persona.correo,
            "direccion": persona.direccion,
            "tipo_persona": persona.tipo_persona,
        },
    }


def sesion_a_dict(usuario, tokens):
    return {
        "usuario": usuario_a_dict(usuario),
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
    }
