import { useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import CampoContrasena from "../../components/common/CampoContrasena";
import { useAuth } from "../../hooks/useAuth";
import { cambiarContrasena } from "../../services/authService";
import { REGLA_CONTRASENA, contrasenaValida } from "../../utils/contrasena";

const ETIQUETAS = {
  ADMINISTRADOR: "Administrador",
  OPERADOR: "Operador",
  BOMBERO: "Bombero",
  CIUDADANO: "Ciudadano",
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
  BLOQUEADO: "Bloqueado",
};

function etiqueta(valor) {
  return ETIQUETAS[valor] || valor;
}

export default function CuentaPage() {
  const { usuario, setUsuario } = useAuth();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(event) {
    event.preventDefault();
    if (!contrasenaValida(nueva)) {
      setMensaje("");
      setError(REGLA_CONTRASENA);
      return;
    }
    setError("");
    setMensaje("");
    setEnviando(true);
    try {
      const sesion = await cambiarContrasena({
        contrasena_actual: actual,
        contrasena_nueva: nueva,
      });
      setUsuario(sesion.usuario);
      setActual("");
      setNueva("");
      setMensaje("Contraseña actualizada");
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const persona = usuario.persona;
  const datos = [
    ["Nombre", `${persona.nombres} ${persona.apellidos}`],
    ["Usuario", usuario.nombre_usuario],
    ["Rol", etiqueta(usuario.rol)],
    ["Estado", etiqueta(usuario.estado)],
    ["Correo", persona.correo || "—"],
    ["Teléfono", persona.telefono || "—"],
    ["Dirección", persona.direccion || "—"],
  ];

  return (
    <AppLayout>
        <div className="icono-usuario" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="32" height="32">
            <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M5.2 19.2c1.5-3.1 3.7-4.6 6.8-4.6s5.3 1.5 6.8 4.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h1>Mi cuenta</h1>
        <p className="bajada">Estos son los datos de tu acceso. Desde aquí puedes cambiar la contraseña.</p>

        <dl className="cuenta-datos">
          {datos.map(([titulo, valor]) => (
            <div key={titulo}>
              <dt>{titulo}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>

        <form className="form-acceso" onSubmit={enviar}>
          <h2>Cambiar contraseña</h2>
          {error && <p className="aviso">{error}</p>}
          {mensaje && <p className="ok">{mensaje}</p>}
          <CampoContrasena
            id="contrasena_actual"
            etiqueta="Contraseña actual"
            autoComplete="current-password"
            value={actual}
            onChange={(event) => setActual(event.target.value)}
            required
          />
          <CampoContrasena
            id="contrasena_nueva"
            etiqueta="Contraseña nueva"
            autoComplete="new-password"
            value={nueva}
            onChange={(event) => setNueva(event.target.value)}
            required
            minLength={8}
          />
          <button className="boton boton-oscuro" type="submit" disabled={enviando}>
            {enviando ? "Guardando…" : "Actualizar contraseña"}
          </button>
        </form>
    </AppLayout>
  );
}
