import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Campo from "../../components/common/Campo";
import CampoContrasena from "../../components/common/CampoContrasena";
import { useAuth } from "../../hooks/useAuth";
import { REGLA_CONTRASENA, contrasenaValida } from "../../utils/contrasena";

const VACIO = {
  nombres: "",
  apellidos: "",
  telefono: "",
  correo: "",
  direccion: "",
  nombre_usuario: "",
  contrasena: "",
  confirmar: "",
};

export default function RegistroPage() {
  const { registrar } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  function cambiar(event) {
    setForm((actual) => ({ ...actual, [event.target.name]: event.target.value }));
  }

  async function enviar(event) {
    event.preventDefault();
    setError("");
    if (!contrasenaValida(form.contrasena)) {
      setError(REGLA_CONTRASENA);
      return;
    }
    if (form.contrasena !== form.confirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setEnviando(true);
    try {
      const { confirmar, ...datos } = form;
      await registrar(datos);
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
        <div className="rejilla">
          <Campo id="nombres" name="nombres" etiqueta="Nombres" value={form.nombres} onChange={cambiar} required />
          <Campo id="apellidos" name="apellidos" etiqueta="Apellidos" value={form.apellidos} onChange={cambiar} required />
        </div>
        <Campo id="telefono" name="telefono" etiqueta="Teléfono" value={form.telefono} onChange={cambiar} />
        <Campo id="correo" name="correo" etiqueta="Correo" type="email" value={form.correo} onChange={cambiar} required />
        <Campo id="direccion" name="direccion" etiqueta="Dirección" value={form.direccion} onChange={cambiar} />
        <Campo
          id="nombre_usuario"
          name="nombre_usuario"
          etiqueta="Usuario"
          autoComplete="username"
          value={form.nombre_usuario}
          onChange={cambiar}
          required
        />
        <CampoContrasena
          id="contrasena"
          name="contrasena"
          etiqueta="Contraseña"
          autoComplete="new-password"
          value={form.contrasena}
          onChange={cambiar}
          required
          minLength={8}
        />
        <CampoContrasena
          id="confirmar"
          name="confirmar"
          etiqueta="Confirmar contraseña"
          autoComplete="new-password"
          value={form.confirmar}
          onChange={cambiar}
          required
          minLength={8}
        />
        <button className="boton boton-oscuro" type="submit" disabled={enviando}>
          {enviando ? "Creando cuenta…" : "Continuar"}
        </button>
    </form>
  );
}
