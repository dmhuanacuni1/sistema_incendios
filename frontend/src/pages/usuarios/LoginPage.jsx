import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CampoContrasena from "../../components/common/CampoContrasena";
import { useAuth } from "../../hooks/useAuth";

export default function LoginPage() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const aviso = useLocation().state?.aviso;
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(event) {
    event.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await entrar({ nombre_usuario: nombreUsuario, contrasena });
      navigate("/cuenta", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="form-acceso" onSubmit={enviar}>
        {aviso && !error && <p className="ok">{aviso}</p>}
        {error && <p className="aviso">{error}</p>}
        <label className="campo-linea" htmlFor="nombre_usuario">
          <span className="sr-only">Usuario</span>
          <input
            id="nombre_usuario"
            name="username"
            placeholder="Usuario"
            autoComplete="username"
            value={nombreUsuario}
            onChange={(event) => setNombreUsuario(event.target.value)}
            required
          />
        </label>
        <CampoContrasena
          id="contrasena"
          name="password"
          etiqueta="Contraseña"
          etiquetaOculta
          placeholder="Contraseña"
          autoComplete="current-password"
          value={contrasena}
          onChange={(event) => setContrasena(event.target.value)}
          required
        />
        <p className="pie-acceso">
          <Link to="/recuperar">Olvidé mi contraseña</Link>
        </p>
        <button className="boton boton-oscuro" type="submit" disabled={enviando}>
          {enviando ? "Entrando…" : "Continuar"}
        </button>
    </form>
  );
}
