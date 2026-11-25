import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ModalMarco from "./ModalMarco";
import Icono from "../layout/IconosVigia";
import Campo from "../common/Campo";
import { estadoRecurso, estadoUnidad, iconoRecurso } from "../recursos/estadosRecursos";
import ImagenEstacion from "../recursos/ImagenEstacion";
import { FOTO_ESTACION_PREDETERMINADA } from "../recursos/fotoEstacion";
import {
  comprimirImagen,
  MAX_ARCHIVO_IMAGEN,
  TIPOS_ACEPTADOS_IMAGEN,
} from "../recursos/comprimirImagen";
import { useVigia } from "../../context/VigiaContext";
import { useAuth } from "../../hooks/useAuth";

function idDe(registro) {
  return registro.id_unidad ?? registro.id_recurso ?? registro.id;
}

// Referencias de demostración para la asignación desde la estación.
const INCIDENTES_ACTIVOS = [
  { id: "INC-1042", titulo: "Foco activo Sector Norte" },
  { id: "INC-1041", titulo: "Alerta preventiva Valle Sur" },
  { id: "INC-1038", titulo: "Incendio en interfaz urbana" },
];

const FORM_VACIO = { nombre: "", direccion: "", telefono: "", foto_url: "" };

export default function ModalEstacion() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "ADMINISTRADOR";
  const {
    estacionSeleccionada,
    cerrarEstacion,
    editarEstacion,
    cambiarEstadoEstacion,
    cambiarEstadoUnidad,
    ajustarRecurso,
    asignarIncidente,
  } = useVigia();
  const [idIncidente, setIdIncidente] = useState("");
  const [avisoAsignacion, setAvisoAsignacion] = useState(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [quitarFoto, setQuitarFoto] = useState(false);
  const [nombreFoto, setNombreFoto] = useState("");
  const [errorFoto, setErrorFoto] = useState("");
  const [motivoBaja, setMotivoBaja] = useState("");
  const [avisoEdicion, setAvisoEdicion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const inputFoto = useRef(null);

  if (!estacionSeleccionada) return null;

  const estacion = estacionSeleccionada;
  const activos = INCIDENTES_ACTIVOS;
  const deBaja = estacion.estado === "DE_BAJA";
  const tieneDotacion =
    estacion.unidades.length > 0 ||
    estacion.recursos.some((recurso) => Number(recurso.cantidad) > 0);

  function despachar(unidad) {
    const destino = unidad.estado === "DISPONIBLE" ? "EN_MISION" : "DISPONIBLE";
    cambiarEstadoUnidad(estacion.id_estacion, idDe(unidad), destino);
  }

  function asignar() {
    setAvisoAsignacion(null);
    if (!idIncidente) {
      setAvisoAsignacion({
        tipo: "error",
        texto: "Selecciona un incidente activo antes de asignar la estación.",
      });
      return;
    }

    const resultado = asignarIncidente(estacion.id_estacion, idIncidente);
    if (!resultado?.ok) {
      setAvisoAsignacion({
        tipo: "error",
        texto: resultado?.mensaje || "No se pudo asignar la estación.",
      });
      return;
    }

    const incidente = activos.find((aviso) => aviso.id === idIncidente);
    setAvisoAsignacion({
      tipo: "ok",
      texto: `Estación asignada a ${incidente?.titulo || idIncidente}.`,
    });
  }

  function empezarEdicion() {
    setForm({
      nombre: estacion.nombre || "",
      direccion: estacion.direccion || "",
      telefono: estacion.telefono || "",
      foto_url: "",
    });
    setQuitarFoto(false);
    setNombreFoto("");
    setErrorFoto("");
    setMotivoBaja(estacion.motivo_baja || "");
    setAvisoEdicion(null);
    setEditando(true);
  }

  function cambiarCampo(evento) {
    setForm((actual) => ({ ...actual, [evento.target.name]: evento.target.value }));
  }

  async function elegirFoto(evento) {
    const archivo = evento.target.files?.[0];
    setErrorFoto("");
    if (!archivo) return;

    function rechazar(mensaje) {
      setErrorFoto(mensaje);
      setForm((actual) => ({ ...actual, foto_url: "" }));
      setNombreFoto("");
      evento.target.value = "";
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
      setQuitarFoto(false);
      setNombreFoto(archivo.name);
    } catch (err) {
      rechazar(err.message);
    }
  }

  function descartarFoto() {
    setQuitarFoto(true);
    setForm((actual) => ({ ...actual, foto_url: "" }));
    setNombreFoto("");
    setErrorFoto("");
    if (inputFoto.current) inputFoto.current.value = "";
  }

  async function guardarEdicion(evento) {
    evento.preventDefault();
    setAvisoEdicion(null);
    setGuardando(true);
    try {
      const datos = {
        nombre: form.nombre,
        direccion: form.direccion,
        telefono: form.telefono,
      };
      if (quitarFoto || form.foto_url) {
        datos.foto_url = quitarFoto ? "" : form.foto_url;
      }

      const resultado = await editarEstacion(estacion.id_estacion, datos);
      if (!resultado.ok) {
        setAvisoEdicion({ tipo: "error", texto: resultado.error });
        return;
      }
      setAvisoEdicion({
        tipo: "ok",
        texto: `${resultado.mensaje} La tarjeta y la foto se refrescaron automáticamente.`,
      });
      setEditando(false);
      setNombreFoto("");
      setQuitarFoto(false);
      if (inputFoto.current) inputFoto.current.value = "";
    } finally {
      setGuardando(false);
    }
  }

  async function alternarBaja() {
    if (
      !deBaja &&
      !window.confirm(
        `¿Dar de baja "${estacion.nombre}"? La estación no se eliminará: seguirá en el sistema y podrás reactivarla.`
      )
    ) {
      return;
    }
    setAvisoEdicion(null);
    setGuardando(true);
    try {
      const resultado = await cambiarEstadoEstacion(
        estacion.id_estacion,
        deBaja ? "ACTIVA" : "DE_BAJA",
        motivoBaja
      );
      setAvisoEdicion({
        tipo: resultado.ok ? "ok" : "error",
        texto: resultado.ok
          ? `${resultado.mensaje} La lista se actualizó automáticamente.`
          : resultado.error,
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalMarco
      onCerrar={cerrarEstacion}
      className="vg-modal-estacion"
      etiqueta={`Gestión de ${estacion.nombre}`}
    >
      <div className="me-foto">
        <ImagenEstacion estacion={estacion} />
        <span className="me-foto-etiqueta">Vista de la estación</span>
      </div>
      <div className="me-cabecera">
        <span className="me-cabecera-icono"><Icono nombre="estacion" tamano={26} /></span>
        <div>
          <span className="me-etiqueta">Gestión de estación</span>
          <h2>
            {estacion.nombre}{" "}
            <span className={`me-estado-badge${deBaja ? " me-estado-badge-baja" : ""}`}>
              <i className="vg-punto" /> {deBaja ? "De baja" : "Activa"}
            </span>
          </h2>
          <p><Icono nombre="ubicacion" tamano={14} /> {estacion.direccion || "Ubicación sin registrar"}</p>
        </div>
      </div>

      <div className="me-cuerpo">
        {esAdmin && (
          <section className="me-seccion me-admin-estacion">
            <div className="me-seccion-titulo">
              <h3><Icono nombre="estacion" tamano={17} /> Datos de la estación</h3>
              <span>Solo administradores</span>
            </div>

            {!editando ? (
              <>
                <p className="me-resumen-estado">
                  Teléfono: {estacion.telefono || "sin registrar"}
                  {deBaja && estacion.motivo_baja
                    ? ` · Motivo de baja: ${estacion.motivo_baja}`
                    : ""}
                </p>
                {deBaja && (
                  <label className="vg-campo me-motivo">
                    <span>Motivo de baja</span>
                    <input
                      type="text"
                      value={motivoBaja}
                      maxLength={500}
                      placeholder="Ej. Cierre temporal por mantenimiento"
                      onChange={(evento) => setMotivoBaja(evento.target.value)}
                    />
                  </label>
                )}
                <div className="me-acciones-admin">
                  <button
                    type="button"
                    className="vg-boton-secundario"
                    onClick={empezarEdicion}
                  >
                    <Icono nombre="editar" tamano={16} /> Editar datos y foto
                  </button>
                  <button
                    type="button"
                    className={deBaja ? "vg-boton-secundario" : "me-boton-baja"}
                    onClick={alternarBaja}
                    disabled={guardando}
                  >
                    <Icono nombre={deBaja ? "check" : "alerta"} tamano={16} />
                    {deBaja ? "Reactivar estación" : "Dar de baja"}
                  </button>
                </div>
              </>
            ) : (
              <form className="me-edicion-form" onSubmit={guardarEdicion}>
                <div className="me-edicion-foto">
                  <img
                    src={form.foto_url || FOTO_ESTACION_PREDETERMINADA}
                    alt="Vista previa de la foto de la estación"
                  />
                  <span>
                    {quitarFoto
                      ? "La foto se quitará al guardar"
                      : form.foto_url
                        ? "Foto nueva seleccionada"
                        : "Foto actual conservada"}
                  </span>
                  <label className="vg-campo">
                    <span>Cambiar fotografía</span>
                    <input
                      ref={inputFoto}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={elegirFoto}
                    />
                    <small>PNG, JPG o WEBP · se comprime automáticamente</small>
                    {nombreFoto && <small className="est-foto-nombre">{nombreFoto}</small>}
                    {errorFoto && <small className="aviso">{errorFoto}</small>}
                  </label>
                  {(estacion.tiene_foto || form.foto_url) && (
                    <button type="button" className="vg-boton-secundario" onClick={descartarFoto}>
                      Quitar foto
                    </button>
                  )}
                </div>

                <div className="me-edicion-campos">
                  <Campo
                    id={`me-nombre-${estacion.id_estacion}`}
                    name="nombre"
                    etiqueta="Nombre"
                    value={form.nombre}
                    onChange={cambiarCampo}
                    maxLength={100}
                    required
                  />
                  <Campo
                    id={`me-telefono-${estacion.id_estacion}`}
                    name="telefono"
                    etiqueta="Teléfono"
                    value={form.telefono}
                    onChange={cambiarCampo}
                    maxLength={20}
                    required
                  />
                  <Campo
                    id={`me-direccion-${estacion.id_estacion}`}
                    name="direccion"
                    etiqueta="Dirección"
                    value={form.direccion}
                    onChange={cambiarCampo}
                    maxLength={255}
                    required
                  />
                </div>

                <div className="me-acciones-admin">
                  <button type="submit" className="vg-boton-principal" disabled={guardando}>
                    <Icono nombre="check" tamano={16} />
                    {guardando ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <button
                    type="button"
                    className="vg-boton-secundario"
                    onClick={() => setEditando(false)}
                    disabled={guardando}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {avisoEdicion && (
              <p
                className={`me-confirmacion${
                  avisoEdicion.tipo === "error" ? " me-confirmacion-error" : ""
                }`}
              >
                <Icono nombre={avisoEdicion.tipo === "error" ? "alerta" : "check"} tamano={15} />
                {avisoEdicion.texto}
              </p>
            )}
          </section>
        )}

        <div className="me-acciones-admin">
          <button
            type="button"
            className="vg-boton-secundario"
            onClick={() => {
              cerrarEstacion();
              navigate(`/recursos/unidades/nueva?estacion=${estacion.id_estacion}`);
            }}
          >
            <Icono nombre="mas" tamano={16} /> Agregar unidad o recurso a esta estación
          </button>
        </div>

        <section className="me-seccion">
          <div className="me-seccion-titulo">
            <h3><Icono nombre="automovil" tamano={17} /> Unidades</h3>
            <span>{estacion.unidades.length} registradas</span>
          </div>
          {estacion.unidades.length > 0 ? (
            <ul className="me-listado">
              {estacion.unidades.map((unidad) => {
                const estado = estadoUnidad(unidad.estado);
                const enBase = unidad.estado === "DISPONIBLE";
                return (
                  <li className="me-fila" key={idDe(unidad)}>
                    <span className="me-fila-icono"><Icono nombre="automovil" tamano={20} /></span>
                    <span className="me-fila-datos">
                      <strong>Unidad Móvil {unidad.codigo || "—"}</strong>
                      <small>{unidad.tipo || "Vehículo"} · Placa/código {unidad.codigo || "—"}</small>
                    </span>
                    <span className={`re-estado ${estado.clase}`}>
                      <i className="vg-punto" /> {estado.etiqueta}
                    </span>
                    <button
                      type="button"
                      className="me-boton-accion"
                      onClick={() => despachar(unidad)}
                    >
                      {enBase ? "Despachar" : "Regresar a base"}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="re-vacio-seccion">Esta estación no tiene unidades registradas.</p>
          )}
        </section>

        <section className="me-seccion">
          <div className="me-seccion-titulo">
            <h3><Icono nombre="capas" tamano={17} /> Recursos disponibles</h3>
            <span>Ajusta el inventario</span>
          </div>
          {estacion.recursos.length > 0 ? (
            <ul className="me-listado">
              {estacion.recursos.map((recurso) => {
                const estado = estadoRecurso(recurso.estado);
                return (
                  <li className="me-fila" key={idDe(recurso)}>
                    <span className="me-fila-icono">
                      <Icono nombre={iconoRecurso(recurso.tipo_recurso)} tamano={20} />
                    </span>
                    <span className="me-fila-datos">
                      <strong>{recurso.nombre}</strong>
                      <small>{estado.etiqueta}{recurso.tipo_recurso ? ` · ${recurso.tipo_recurso}` : ""}</small>
                    </span>
                    <div className="me-contador">
                      <button
                        type="button"
                        onClick={() => ajustarRecurso(estacion.id_estacion, idDe(recurso), -1)}
                        aria-label={`Reducir ${recurso.nombre}`}
                      >
                        <Icono nombre="menos" tamano={15} />
                      </button>
                      <strong>{recurso.cantidad}</strong>
                      <button
                        type="button"
                        onClick={() => ajustarRecurso(estacion.id_estacion, idDe(recurso), 1)}
                        aria-label={`Aumentar ${recurso.nombre}`}
                      >
                        <Icono nombre="mas" tamano={15} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="re-vacio-seccion">Esta estación no tiene recursos registrados.</p>
          )}
        </section>

        <section className="me-seccion">
          <div className="me-seccion-titulo">
            <h3><Icono nombre="incidente" tamano={17} /> Asignar a un incidente</h3>
            <span>{activos.length} activos</span>
          </div>
          <div className="me-asignar">
            <label className="vg-campo">
              <span>Incidente activo</span>
              <select value={idIncidente} onChange={(evento) => setIdIncidente(evento.target.value)}>
                <option value="">Selecciona un incidente…</option>
                {activos.map((aviso) => (
                  <option key={aviso.id} value={aviso.id}>
                    {aviso.id} · {aviso.titulo}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="vg-boton-principal"
              onClick={asignar}
              disabled={!tieneDotacion}
              title={tieneDotacion ? undefined : "Registra una unidad o un recurso antes de asignar"}
            >
              <Icono nombre="check" tamano={16} /> Asignar estación
            </button>
          </div>
          {!tieneDotacion && (
            <p className="me-aviso-asignacion">
              <Icono nombre="alerta" tamano={15} />
              Esta estación no tiene unidades ni recursos con existencia. Registra al menos uno
              antes de asignarla a un incidente.
            </p>
          )}
          {avisoAsignacion && (
            <p
              className={`me-confirmacion${
                avisoAsignacion.tipo === "error" ? " me-confirmacion-error" : ""
              }`}
            >
              <Icono nombre={avisoAsignacion.tipo === "error" ? "alerta" : "check"} tamano={15} />
              {avisoAsignacion.texto}
            </p>
          )}
          {estacion.incidenteAsignado && (
            <p className="me-asignado">
              Asignada actualmente a: <strong>{estacion.incidenteAsignado}</strong>
            </p>
          )}
        </section>

        <p className="me-aviso-local">
          <Icono nombre="alerta" tamano={15} />
          Los cambios de unidades, recursos y asignación son locales para la demostración.
          Los datos, la fotografía y el estado de la estación sí se guardan en la base de datos.
        </p>
      </div>
    </ModalMarco>
  );
}
