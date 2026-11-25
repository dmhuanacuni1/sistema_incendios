import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Campo from "../../components/common/Campo";
import AppLayout from "../../components/layout/AppLayout";
import { useVigia } from "../../context/VigiaContext";
import {
  comprimirImagen,
  MAX_ARCHIVO_IMAGEN,
  TIPOS_ACEPTADOS_IMAGEN,
} from "../../components/recursos/comprimirImagen";
import { FOTO_ESTACION_PREDETERMINADA } from "../../components/recursos/fotoEstacion";
import * as estacionesService from "../../services/estacionesService";

const VACIO = { nombre: "", direccion: "", telefono: "", foto_url: "" };

export default function FrmRegEstacion() {
  const { cargarEstaciones } = useVigia();
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [nombreFoto, setNombreFoto] = useState("");
  const [errorFoto, setErrorFoto] = useState("");
  const inputFoto = useRef(null);

  function cambiar(event) {
    setForm((actual) => ({ ...actual, [event.target.name]: event.target.value }));
  }

  async function elegirFoto(event) {
    const archivo = event.target.files?.[0];
    setErrorFoto("");
    if (!archivo) {
      setForm((actual) => ({ ...actual, foto_url: "" }));
      setNombreFoto("");
      return;
    }
    function rechazar(mensaje) {
      setErrorFoto(mensaje);
      setForm((actual) => ({ ...actual, foto_url: "" }));
      setNombreFoto("");
      event.target.value = "";
    }

    if (!TIPOS_ACEPTADOS_IMAGEN.test(archivo.type)) {
      rechazar("Formato no soportado. Usa PNG, JPG o WEBP.");
      return;
    }
    if (archivo.size > MAX_ARCHIVO_IMAGEN) {
      rechazar("La imagen seleccionada es demasiado grande.");
      return;
    }

    try {
      const resultado = await comprimirImagen(archivo);
      setForm((actual) => ({ ...actual, foto_url: resultado }));
      setNombreFoto(archivo.name);
    } catch (err) {
      rechazar(err.message);
    }
  }

  function quitarFoto() {
    setForm((actual) => ({ ...actual, foto_url: "" }));
    setNombreFoto("");
    setErrorFoto("");
    if (inputFoto.current) inputFoto.current.value = "";
  }

  async function registrar(event) {
    event.preventDefault();
    setError("");
    setMensaje("");
    setGuardando(true);
    try {
      const conFoto = Boolean(form.foto_url);
      const respuesta = await estacionesService.crear(form);
      setMensaje(
        `${respuesta.mensaje || "Estación registrada correctamente"}${
          conFoto ? " La foto quedó guardada en la base de datos." : ""
        } La lista de estaciones ya se actualizó.`
      );
      setForm(VACIO);
      await cargarEstaciones();
      setNombreFoto("");
      if (inputFoto.current) inputFoto.current.value = "";
    } catch (err) {
      // No tocamos `form`: el usuario conserva lo que ya escribió.
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <AppLayout ancha>
      <section className="cuenta-tarjeta cuenta-tarjeta-ancha">
        <h1>Registrar estación</h1>
        <p className="bajada">
          La tabla física no tiene código: la estación se identifica por nombre y dirección.
          El administrador se toma automáticamente de tu sesión y la foto se guarda en la base de datos junto con la estación.
        </p>
        {error && <p className="aviso">{error}</p>}
        {mensaje && <p className="ok">{mensaje}</p>}

        <form className="form-acceso" onSubmit={registrar} noValidate>
          <div className="est-foto-form">
            <div className="est-foto-form-vista">
              <img
                src={form.foto_url || FOTO_ESTACION_PREDETERMINADA}
                alt="Vista previa de la estación"
              />
              <span className="est-foto-form-etiqueta">
                {form.foto_url ? "Foto seleccionada" : "Foto de ejemplo"}
              </span>
            </div>
            <label className="campo est-foto-form-campo" htmlFor="est-foto">
              <span>Foto de la estación</span>
              <input
                id="est-foto"
                ref={inputFoto}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={elegirFoto}
              />
              <small>PNG, JPG o WEBP · se comprime automáticamente</small>
              {nombreFoto && <small className="est-foto-nombre">{nombreFoto}</small>}
              {errorFoto && <small className="aviso">{errorFoto}</small>}
              {form.foto_url && (
                <button type="button" className="vg-boton-secundario" onClick={quitarFoto}>
                  Quitar foto
                </button>
              )}
            </label>
          </div>

          <div className="rejilla">
            <Campo
              id="est-nombre"
              name="nombre"
              etiqueta="Nombre"
              value={form.nombre}
              onChange={cambiar}
              maxLength={100}
              required
            />
            <Campo
              id="est-telefono"
              name="telefono"
              etiqueta="Teléfono"
              value={form.telefono}
              onChange={cambiar}
              maxLength={20}
              placeholder="Ej. 4421111"
              required
            />
          </div>
          <Campo
            id="est-direccion"
            name="direccion"
            etiqueta="Dirección"
            value={form.direccion}
            onChange={cambiar}
            maxLength={255}
            required
          />
          <div className="acciones-form">
            <button className="boton boton-oscuro" type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Registrar estación"}
            </button>
            <Link to="/recursos/unidades/nueva">Registrar unidad o recurso →</Link>
            <Link to="/recursos/consultar">Consultar infraestructura →</Link>
          </div>
        </form>
      </section>
    </AppLayout>
  );
}
