import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function LoginPage() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
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
        <label className="campo-linea" htmlFor="contrasena">
          <span className="sr-only">Contraseña</span>
          <input
            id="contrasena"
            name="password"
            type="password"
            placeholder="Contraseña"
            autoComplete="current-password"
            value={contrasena}
            onChange={(event) => setContrasena(event.target.value)}
            required
          />
        </label>
        <button className="boton boton-oscuro" type="submit" disabled={enviando}>
          {enviando ? "Entrando…" : "Continuar"}
        </button>
    </form>
  );
}
