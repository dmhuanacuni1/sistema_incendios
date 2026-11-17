import os
import smtplib
from email.message import EmailMessage
from pathlib import Path

from dotenv import load_dotenv
from flask import current_app

from app.utils.errores import ErrorApp

_CORREO_ENV = Path(__file__).resolve().parents[2] / "correo.env"


def _cargar():
    load_dotenv(_CORREO_ENV, override=True)


def _limpio(nombre):
    return os.environ.get(nombre, "").strip().strip('"')


def smtp_configurado():
    _cargar()
    return bool(_limpio("SMTP_HOST") and _limpio("SMTP_USER") and _limpio("SMTP_PASSWORD"))


def enviar_recuperacion(destino, enlace):
    if not smtp_configurado():
        print(f"RECUPERAR CONTRASEÑA: {enlace}", flush=True)
        return

    remitente = _limpio("SMTP_FROM") or _limpio("SMTP_USER")
    mensaje = EmailMessage()
    mensaje["Subject"] = "Recuperar contraseña — Sistema de incendios"
    mensaje["From"] = remitente
    mensaje["To"] = destino
    texto = (
        "Pediste una contraseña nueva.\n\n"
        f"Abre este enlace (vence en una hora):\n{enlace}\n\n"
        "Si no fuiste tú, ignora este mensaje."
    )
    html = (
        "<p>Pediste una contraseña nueva.</p>"
        f'<p><a href="{enlace}">Elegir una contraseña nueva</a></p>'
        "<p>El enlace vence en una hora. Si no fuiste tú, ignora este mensaje.</p>"
    )
    mensaje.set_content(texto)
    mensaje.add_alternative(html, subtype="html")

    host = _limpio("SMTP_HOST")
    puerto = int(_limpio("SMTP_PORT") or "587")
    usa_ssl = _limpio("SMTP_USE_SSL").lower() == "true"
    usa_tls = _limpio("SMTP_USE_TLS").lower() != "false"
    try:
        if usa_ssl:
            servidor = smtplib.SMTP_SSL(host, puerto, timeout=20)
        else:
            servidor = smtplib.SMTP(host, puerto, timeout=20)
        with servidor:
            servidor.ehlo()
            if usa_tls and not usa_ssl:
                servidor.starttls()
                servidor.ehlo()
            servidor.login(_limpio("SMTP_USER"), _limpio("SMTP_PASSWORD").replace(" ", ""))
            servidor.send_message(mensaje)
    except (OSError, smtplib.SMTPException) as exc:
        current_app.logger.exception("No se pudo enviar el correo de recuperación")
        raise ErrorApp("No se pudo enviar el correo. Revisa la configuración SMTP.", 500) from exc
