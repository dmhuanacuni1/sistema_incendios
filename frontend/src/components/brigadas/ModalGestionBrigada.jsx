import { useCallback, useEffect, useState } from "react";
import Icono from "../layout/IconosVigia";
import * as brigadasService from "../../services/brigadasService";
import { ROLES_BRIGADA, estadoMiembro, etiquetaRolBrigada } from "./estadosBrigada";

export default function ModalGestionBrigada({ brigada, esGestor, onCerrar, onCambios }) {
  const [integrantes, setIntegrantes] = useState([]);
  const [disponibles, setDisponibles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [seleccionados, setSeleccionados] = useState([]);
  const [buscaBombero, setBuscaBombero] = useState("");
  const [rol, setRol] = useState("BOMBERO");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const lista = await brigadasService.miembros(brigada.id_brigada);
      setIntegrantes(lista);
      if (esGestor) setDisponibles(await brigadasService.bomberosDisponibles());
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [brigada.id_brigada, esGestor]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function asignar(evento) {
    evento.preventDefault();
    setError("");
    setMensaje("");
    setGuardando(true);
    try {
      const respuesta = await brigadasService.asignarMiembros(
        brigada.id_brigada,
        seleccionados.map((idPersona) => ({
          id_persona: idPersona,
          rol_en_brigada: rol,
        }))
      );
      setMensaje(respuesta.mensaje);
      setSeleccionados([]);
      await cargar();
      onCambios?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function retirar(miembro) {
    if (!window.confirm(`¿Retirar a ${miembro.nombres} ${miembro.apellidos} de la brigada?`)) {
      return;
    }
    setError("");
    setMensaje("");
    try {
      const respuesta = await brigadasService.retirarMiembro(
        brigada.id_brigada,
        miembro.id_persona
      );
      setMensaje(respuesta.mensaje);
      await cargar();
      onCambios?.();
    } catch (err) {
      setError(err.message);
    }
  }

  const activos = integrantes.filter((miembro) => miembro.estado === "ACTIVO");
  const textoBusqueda = buscaBombero.trim().toLowerCase();
  const bomberosFiltrados = disponibles.filter((bombero) =>
    `${bombero.nombre} ${bombero.nombre_usuario}`.toLowerCase().includes(textoBusqueda)
  );

  return (
    <div className="vg-modal-fondo" onMouseDown={(evento) => evento.target === evento.currentTarget && onCerrar()}>
      <div className="vg-modal bg-modal" role="dialog" aria-modal="true" aria-label="Gestionar integrantes">
        <button type="button" className="vg-modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <Icono nombre="cerrar" tamano={18} />
        </button>

        <div className="bg-modal-cabecera">
          <span className="bg-modal-icono"><Icono nombre="escudo" tamano={24} /></span>
          <div>
            <span className="re-etiqueta">Gestión de brigada</span>
            <h2>{brigada.nombre}</h2>
            <p>
              <Icono nombre="ubicacion" tamano={14} /> {brigada.estacion || "Sin estación"}
              {" · "}
              {activos.length} integrante{activos.length === 1 ? "" : "s"} activo
              {activos.length === 1 ? "" : "s"}
              {" · cupo "}{brigada.total_miembros}{"/"}{brigada.max_integrantes}
            </p>
          </div>
        </div>

        <div className="bg-modal-cuerpo">
          {error && <p className="aviso">{error}</p>}
          {mensaje && <p className="ok">{mensaje}</p>}
          {cargando && <p className="estado">Cargando integrantes.</p>}

          {!cargando && (
            <>
              <section className="bg-seccion">
                <h3><Icono nombre="usuario" tamano={17} /> Integrantes de la brigada</h3>
                {integrantes.length === 0 ? (
                  <p className="re-vacio-seccion">Esta brigada todavía no tiene integrantes.</p>
                ) : (
                  <ul className="bg-listado">
                    {integrantes.map((miembro) => (
                      <li className={`bg-fila${miembro.estado === "ACTIVO" ? "" : " bg-fila-inactivo"}`} key={miembro.id_brigada_miembro}>
                        <span className="bg-fila-icono"><Icono nombre="usuario" tamano={18} /></span>
                        <span className="re-unidad-datos">
                          <strong>{miembro.nombres} {miembro.apellidos}</strong>
                          <small>
                            {etiquetaRolBrigada(miembro.rol_en_brigada)} · {miembro.nombre_usuario || "-"}
                            {" · "}{estadoMiembro(miembro.estado).etiqueta}
                          </small>
                        </span>
                        {esGestor && miembro.estado === "ACTIVO" && (
                          <button type="button" className="vg-boton-secundario" onClick={() => retirar(miembro)}>
                            Retirar
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {esGestor && (
                <section className="bg-seccion">
                  <h3><Icono nombre="mas" tamano={17} /> Asignar bomberos</h3>
                  {disponibles.length === 0 ? (
                    <p className="re-vacio-seccion">
                      No hay bomberos disponibles: todos están asignados a otra brigada activa.
                    </p>
                  ) : (
                    <form className="bg-forma" onSubmit={asignar}>
                      <label className="campo" htmlFor="bg-busca-bombero">
                        <span>Buscar bombero por nombre o usuario</span>
                        <input
                          id="bg-busca-bombero"
                          type="search"
                          value={buscaBombero}
                          onChange={(evento) => setBuscaBombero(evento.target.value)}
                          placeholder="Ej. Rosa o bombero_rosa"
                        />
                      </label>
                      {bomberosFiltrados.length === 0 ? (
                        <p className="re-vacio-seccion">
                          Ningún bombero coincide con "{buscaBombero}".
                        </p>
                      ) : (
                        <>
                      <label className="campo" htmlFor="bg-bomberos">
                        <span>Bomberos disponibles (puedes elegir varios)</span>
                        <select
                          id="bg-bomberos"
                          multiple
                          size={Math.min(5, Math.max(3, bomberosFiltrados.length))}
                          value={seleccionados.map(String)}
                          onChange={(evento) =>
                            setSeleccionados(
                              Array.from(evento.target.selectedOptions, (opcion) => Number(opcion.value))
                            )
                          }
                          required
                        >
                          {bomberosFiltrados.map((bombero) => (
                            <option key={bombero.id_persona} value={bombero.id_persona}>
                              {bombero.nombre} ({bombero.nombre_usuario})
                            </option>
                          ))}
                        </select>
                      </label>
                        </>
                      )}

                      <label className="campo" htmlFor="bg-rol">
                        <span>Rol dentro de la brigada</span>
                        <select id="bg-rol" value={rol} onChange={(evento) => setRol(evento.target.value)}>
                          {ROLES_BRIGADA.map(([codigo, etiqueta]) => (
                            <option key={codigo} value={codigo}>{etiqueta}</option>
                          ))}
                        </select>
                      </label>

                      <div className="acciones-form">
                        <button className="boton boton-oscuro" type="submit" disabled={guardando || seleccionados.length === 0}>
                          {guardando ? "Guardando." : "Asignar y notificar"}
                        </button>
                      </div>
                      <p className="estado">
                        El sistema consulta la disponibilidad y registra una notificación interna
                        para los integrantes asignados.
                      </p>
                    </form>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
