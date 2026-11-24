"""Servicio para la gestión de alertas y notificaciones."""
from datetime import datetime, timezone
from app.config.database import db
from app.models.alertas import Alerta, AlertaDestinatario, TipoAlerta
from app.models.usuario import Usuario, Rol
from app.models.incidente import Incidente
from app.models.zona_riesgo import ZonaRiesgo
from app.models.brigada import BrigadaMiembro
from sqlalchemy import text

class AlertasService:

    def _obtener_tipo_alerta(self, nombre_tipo: str) -> TipoAlerta:
        tipo = TipoAlerta.query.filter_by(nombre=nombre_tipo).first()
        if not tipo:
            print(f"⚠️ No se encontró el tipo '{nombre_tipo}', usando el primero disponible.")
            tipo = TipoAlerta.query.first()
            if not tipo:
                raise ValueError("La tabla tipos_alerta está vacía.")
        return tipo

    def _crear_alerta_base(self, nombre_tipo: str, mensaje: str, id_incidente: int = None, personas_ids: list = None):
        try:
            tipo = self._obtener_tipo_alerta(nombre_tipo)
            
            alerta = Alerta(
                id_incidente=id_incidente,
                id_tipo_alerta=tipo.id_tipo_alerta,
                mensaje=mensaje
            )
            db.session.add(alerta)
            db.session.flush() # Para obtener el id_alerta generado

            if personas_ids:
                for id_persona in set(personas_ids): # set para evitar duplicados
                    if id_persona:
                        dest = AlertaDestinatario(id_alerta=alerta.id_alerta, id_persona=id_persona)
                        db.session.add(dest)

            db.session.commit()
            print(f"✅ ALERTA CREADA: ID {alerta.id_alerta} - {nombre_tipo}")
            return alerta
        except Exception as e:
            db.session.rollback() # Si falla, cancelamos la transacción para no romper la sesión
            print(f"❌ ERROR AL CREAR ALERTA: {e}")
            return None

    def generar_alerta_nuevo_incidente(self, incidente: Incidente):
        """RF-01 y RF-03: Evalúa la gravedad para generar Alerta Roja o Amarilla."""
        destinatarios = Usuario.query.join(Rol).filter(
            Rol.nombre_rol.in_(["OPERADOR", "BOMBERO", "ADMINISTRADOR"])
        ).all()
        ids_destinatarios = [u.id_persona for u in destinatarios]

        es_zona_critica = False
        if incidente.id_zona:
            zona = ZonaRiesgo.query.get(incidente.id_zona)
            if zona and zona.nivel_riesgo in ["ALTO", "EXTREMO"]:
                es_zona_critica = True

        if incidente.gravedad in ["ALTA", "CATASTROFICA"] or es_zona_critica:
            tipo_alerta = "ALERTA ROJA - EVACUACIÓN"
            tipo = self._obtener_tipo_alerta(tipo_alerta)
            mensaje = tipo.plantilla_mensaje.replace("{zona}", str(incidente.ubicacion)).replace("{refugio}", "el punto de encuentro más cercano")
        else:
            tipo_alerta = "ALERTA AMARILLA - PREVENCIÓN"
            tipo = self._obtener_tipo_alerta(tipo_alerta)
            mensaje = tipo.plantilla_mensaje.replace("{zona}", str(incidente.ubicacion))

        return self._crear_alerta_base(tipo_alerta, mensaje, incidente.id_incidente, ids_destinatarios)

    def notificar_registro_ciudadano(self, incidente: Incidente):
        """RF-07: Notifica al ciudadano específico que su reporte fue registrado."""
        if not incidente.id_aviso:
            return None
            
        # Buscamos el ID del ciudadano usando SQL directo para evitar errores de importación
        try:
            query = text(f"SELECT id_ciudadano FROM avisos_incendio WHERE id_aviso = {incidente.id_aviso}")
            resultado = db.session.execute(query).fetchone()
            
            if resultado and resultado[0]:
                ids_destinatarios = [resultado[0]]
                tipo_alerta = "ALERTA AMARILLA - PREVENCIÓN"
                mensaje = f"✅ REPORTE REGISTRADO: Tu aviso en {incidente.ubicacion} ha sido recibido. Código: #{incidente.id_incidente}."
                return self._crear_alerta_base(tipo_alerta, mensaje, incidente.id_incidente, ids_destinatarios)
        except Exception as e:
            print(f"Error buscando ciudadano: {e}")
            
        return None

    def notificar_aviso_descartado(self, aviso, motivo=None):
        """Notifica al ciudadano cuando un operador descarta su aviso (Falso aviso)."""
        if not aviso or not aviso.id_ciudadano: 
            return None
            
        ids_destinatarios = [aviso.id_ciudadano]
        tipo_alerta = "ALERTA ROJA - EVACUACIÓN"  # Usamos roja para que el ciudadano note el cierre del caso
        
        # Si hay un motivo, lo incluimos en el mensaje
        motivo_texto = f" Motivo: {motivo}." if motivo else ""
        mensaje = f"❌ AVISO DESCARTADO: Tu reporte #{aviso.id_aviso} en {aviso.ubicacion} fue evaluado y descartado.{motivo_texto}"
        
        return self._crear_alerta_base(tipo_alerta, mensaje, None, ids_destinatarios)

    def notificar_cambio_estado(self, incidente: Incidente):
        """RF-08: Notifica al ciudadano sobre el cambio de estado."""
        if not incidente.id_aviso:
            return None
            
        try:
            query = text(f"SELECT id_ciudadano FROM avisos_incendio WHERE id_aviso = {incidente.id_aviso}")
            resultado = db.session.execute(query).fetchone()
            
            if resultado and resultado[0]:
                ids_destinatarios = [resultado[0]]
                
                if incidente.estado in ["CONTROLADO", "EXTINGUIDO", "CERRADO"]:
                    tipo_alerta = "ALERTA VERDE - CONTROLADO"
                    tipo = self._obtener_tipo_alerta(tipo_alerta)
                    mensaje = tipo.plantilla_mensaje.replace("{zona}", str(incidente.ubicacion))
                else:
                    tipo_alerta = "ALERTA AMARILLA - PREVENCIÓN"
                    mensaje = f"El incidente en {incidente.ubicacion} ha cambiado su estado a: {incidente.estado}."

                return self._crear_alerta_base(tipo_alerta, mensaje, incidente.id_incidente, ids_destinatarios)
        except Exception as e:
             print(f"Error notificando cambio de estado: {e}")
        return None

    def notificar_asignacion_brigada(self, id_incidente: int, id_brigada: int):
        """RF-06: Notifica a los brigadistas asignados buscando a los miembros."""
        incidente = Incidente.query.get(id_incidente)
        if not incidente: return None

        miembros = BrigadaMiembro.query.filter_by(id_brigada=id_brigada).all()
        ids_destinatarios = [m.id_persona for m in miembros]

        tipo_alerta = "ALERTA AMARILLA - PREVENCIÓN" 
        mensaje = f"ASIGNACIÓN: Ha sido despachado al incidente #{id_incidente} en {incidente.ubicacion}. Gravedad: {incidente.gravedad}."
        
        if ids_destinatarios:
            return self._crear_alerta_base(tipo_alerta, mensaje, id_incidente, ids_destinatarios)
        return None

    def notificar_aviso_ciudadano(self, aviso):
        """RF-07: Notifica al ciudadano que su AVISO fue registrado (aún no es incidente)."""
        if not aviso or not aviso.id_ciudadano: 
            return None
            
        ids_destinatarios = [aviso.id_ciudadano]
        tipo_alerta = "ALERTA AMARILLA - PREVENCIÓN"
        mensaje = f"✅ REPORTE REGISTRADO: Tu aviso en {aviso.ubicacion} ha sido recibido. Código de seguimiento: #{aviso.id_aviso}."
        
        # Nota: Como aún no hay incidente, pasamos None en id_incidente
        return self._crear_alerta_base(tipo_alerta, mensaje, None, ids_destinatarios)

    def notificar_aviso_operadores(self, aviso):
        """Notifica a Operadores y Admins que hay un nuevo aviso en Triage."""
        destinatarios = Usuario.query.join(Rol).filter(
            Rol.nombre_rol.in_(["OPERADOR", "ADMINISTRADOR"])
        ).all()
        ids_destinatarios = [u.id_persona for u in destinatarios]
        
        tipo_alerta = "ALERTA AMARILLA - PREVENCIÓN"
        mensaje = f"🔔 NUEVO AVISO: Reporte ciudadano en {aviso.ubicacion}. Urgencia: {aviso.nivel_urgencia}. (Aviso #{aviso.id_aviso})"
        
        return self._crear_alerta_base(tipo_alerta, mensaje, None, ids_destinatarios)

    def notificar_aviso_verificado(self, aviso):
        """Notifica al ciudadano cuando un operador verifica su aviso."""
        if not aviso or not aviso.id_ciudadano: 
            return None
            
        ids_destinatarios = [aviso.id_ciudadano]
        tipo_alerta = "ALERTA AMARILLA - PREVENCIÓN"
        mensaje = f"🔍 AVISO VERIFICADO: Tu reporte #{aviso.id_aviso} ha sido validado por la central. Una brigada está siendo asignada."
        
        return self._crear_alerta_base(tipo_alerta, mensaje, None, ids_destinatarios)

    def confirmar_recepcion(self, id_alerta: int, id_persona: int):
        """CU-09: El bombero/ciudadano confirma que recibió la alerta."""
        dest = AlertaDestinatario.query.filter_by(id_alerta=id_alerta, id_persona=id_persona).first()
        if dest:
            dest.confirmada = True
            dest.estado_envio = "ENTREGADO"
            dest.fecha_confirmacion = datetime.now(timezone.utc)
            db.session.commit()
            return True
        return False