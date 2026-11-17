import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CampoContrasena from "../../components/common/CampoContrasena";
import { restablecer } from "../../services/authService";
import { REGLA_CONTRASENA, contrasenaValida } from "../../utils/contrasena";

export default function RestablecerPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(event) {
    event.preventDefault();
    setError("");
    if (!contrasenaValida(nueva)) {
      setError(REGLA_CONTRASENA);
      return;
    }
    if (nueva !== confirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setEnviando(true);
    try {
      const data = await restablecer({ token, contrasena: nueva });
      navigate("/login", { replace: true, state: { aviso: data.mensaje } });
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <form className="form-acceso" onSubmit={enviar}>
      {error && <p className="aviso">{error}</p>}
      <CampoContrasena
        id="nueva"
        etiqueta="Contraseña nueva"
        etiquetaOculta
        placeholder="Contraseña nueva"
        autoComplete="new-password"
        value={nueva}
        onChange={(event) => setNueva(event.target.value)}
        required
        minLength={8}
      />
      <CampoContrasena
        id="confirmar"
        etiqueta="Confirmar contraseña"
        etiquetaOculta
        placeholder="Confirmar contraseña"
        autoComplete="new-password"
        value={confirmar}
        onChange={(event) => setConfirmar(event.target.value)}
        required
        minLength={8}
      />
      <button className="boton boton-oscuro" type="submit" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
