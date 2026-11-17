import { useState } from "react";
import { recuperar } from "../../services/authService";

export default function RecuperarPage() {
  const [correo, setCorreo] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(event) {
    event.preventDefault();
    setError("");
    setMensaje("");
    setEnviando(true);
    try {
      const data = await recuperar(correo.trim());
      setMensaje(data.mensaje);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="form-acceso" onSubmit={enviar}>
      {error && <p className="aviso">{error}</p>}
      {mensaje && <p className="ok">{mensaje}</p>}
      <label className="campo-linea" htmlFor="correo">
        <span className="sr-only">Correo</span>
        <input
          id="correo"
          name="correo"
          type="email"
          placeholder="Correo"
          autoComplete="email"
          value={correo}
          onChange={(event) => setCorreo(event.target.value)}
          required
        />
      </label>
      <button className="boton boton-oscuro" type="submit" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar enlace"}
      </button>
    </form>
  );
}
