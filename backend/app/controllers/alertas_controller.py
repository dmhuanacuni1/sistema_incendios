from flask import g, request
from app.models.alertas import Alerta, AlertaDestinatario
from app.services.alertas_service import AlertasService
from app.views.response_view import success_response
from app.middleware.error_handler import ValidationError

class AlertasController:
    def __init__(self):
        self._service = AlertasService()

    def mis_alertas(self):
        """Para que el Bombero/Ciudadano vea sus notificaciones."""
        usuario = g.usuario
        destinatarios = AlertaDestinatario.query.filter_by(id_persona=usuario.id_persona).order_by(AlertaDestinatario.id_alerta.desc()).all()
        
        data = []
        for dest in destinatarios:
            data.append({
                "id_alerta": dest.id_alerta,
                "id_incidente": dest.alerta.id_incidente, # <-- AGREGADO: Para que salga el #ID
                "mensaje": dest.alerta.mensaje,
                "tipo": dest.alerta.tipo.nombre,
                "fecha": dest.alerta.fecha_hora.isoformat(),
                "confirmada": dest.confirmada,
                "estado_envio": dest.estado_envio
            })
        return success_response(data=data, message="Mis alertas")

    def confirmar(self, id_alerta: int):
        """El usuario confirma que recibió la alerta."""
        usuario = g.usuario
        exito = self._service.confirmar_recepcion(id_alerta, usuario.id_persona)
        if not exito:
            raise ValidationError("Alerta no encontrada o no asignada a usted.")
        return success_response(message="Recepción confirmada correctamente")

    def historial(self):
        """Para Operador/Admin (RF-09). Validación manual de roles."""
        usuario = g.usuario
        
        # Validación manual: Solo ADMINISTRADOR u OPERADOR
        rol_usuario = getattr(getattr(usuario, "rol", None), "nombre_rol", "")
        if rol_usuario not in ["ADMINISTRADOR", "OPERADOR"]:
            raise ValidationError("No tiene permisos para ver el historial de alertas.")

        # FILTRO: Ocultamos los mensajes de "REPORTE REGISTRADO" que son solo para ciudadanos
        alertas = Alerta.query.filter(
            ~Alerta.mensaje.like("✅ REPORTE REGISTRADO%")
        ).order_by(Alerta.fecha_hora.desc()).limit(100).all()
        
        data = [{
            "id_alerta": a.id_alerta,
            "id_incidente": a.id_incidente,
            "tipo": a.tipo.nombre,
            "mensaje": a.mensaje,
            "fecha_hora": a.fecha_hora.isoformat()
        } for a in alertas]
        
        return success_response(data=data, message="Historial de alertas")