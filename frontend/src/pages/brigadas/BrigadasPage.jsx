import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ModalCambioEstadoBrigada from "../../components/brigadas/ModalCambioEstadoBrigada";
import ModalGestionBrigada from "../../components/brigadas/ModalGestionBrigada";
import {
  claseEstadoBrigada,
  etiquetaEstadoBrigada,
  etiquetaRolBrigada,
} from "../../components/brigadas/estadosBrigada";
import AppLayout from "../../components/layout/AppLayout";
import Icono from "../../components/layout/IconosVigia";
import { useAuth } from "../../hooks/useAuth";
import * as brigadasService from "../../services/brigadasService";

export default function BrigadasPage() {
  const { usuario } = useAuth();
  const { state } = useLocation();
  const esAdmin = usuario?.rol === "ADMINISTRADOR";
  const esGestor = esAdmin || usuario?.rol === "OPERADOR";
  const esBombero = usuario?.rol === "BOMBERO";

  const [misBrigadas, setMisBrigadas] = useState([]);
  const [cargandoMis, setCargandoMis] = useState(false);
  const [brigadas, setBrigadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState(state?.mensaje || "");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("nombre_asc");
  const [gestionando, setGestionando] = useState(null);
  const [editorEstado, setEditorEstado] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setBrigadas(await brigadasService.listar({ orden }));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [orden]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cargarDatosBombero = useCallback(async () => {
    if (!esBombero) return;
    setCargandoMis(true);
    try {
      setMisBrigadas(await brigadasService.misBrigadas());
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoMis(false);
    }
  }, [esBombero]);

  useEffect(() => {
    cargarDatosBombero();
  }, [cargarDatosBombero]);

  useEffect(() => {
    function alResponder() {
      cargarDatosBombero();
      cargar();
    }
    window.addEventListener("brigadas:notificacion-respondida", alResponder);
    return () => {
      window.removeEventListener("brigadas:notificacion-respondida", alResponder);
    };
  }, [cargarDatosBombero, cargar]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return brigadas;
    return brigadas.filter((brigada) =>
      [brigada.nombre, brigada.estacion, etiquetaEstadoBrigada(brigada.estado)]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [brigadas, busqueda]);

  const kpis = useMemo(
    () => ({
      total: brigadas.length,
      disponibles: brigadas.filter((brigada) => brigada.disponible).length,
      operacion: brigadas.filter((brigada) => brigada.estado === "EN_OPERACION").length,
      integrantes: brigadas.reduce((suma, brigada) => suma + brigada.total_miembros, 0),
    }),
    [brigadas]
  );

  async function guardarEstado(item, estado, motivo) {
    setError("");
    setMensaje("");
    setGuardando(true);
    try {
      let respuesta;
      if (estado === "DISUELTA") {
        respuesta = await brigadasService.desactivar(item.id_brigada, motivo);
      } else if (item.estado === "DISUELTA" && estado === "ACTIVA") {
        respuesta = await brigadasService.reactivar(item.id_brigada, motivo);
      } else {
        respuesta = await brigadasService.cambiarEstado(item.id_brigada, estado, motivo);
      }
      setMensaje(`${respuesta.mensaje} · ${item.nombre}`);
      setEditorEstado(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function reactivar(brigada) {
    await guardarEstado(brigada, "ACTIVA", "");
  }

  return (
    <AppLayout ancha suelta>
      <div className="re-pagina">
        <div className="re-titulo">
          <div>
            <span className="re-etiqueta">Iteración 3 · Brigadas</span>
            <h1>Gestión de Brigadas</h1>
            <p>Cuadrillas, integrantes, estados y disponibilidad operativa.</p>
          </div>
          <Link to="/brigadas/consultar" className="re-enlace-consulta">
            Consulta detallada <Icono nombre="chevronDerecha" tamano={15} />
          </Link>
        </div>

        {esBombero && (
          <section className="bg-mis-brigadas">
            <div className="bg-mis-cabecera">
              <span className="re-card-icono"><Icono nombre="escudo" tamano={22} /></span>
              <div>
                <span className="re-etiqueta">Tu información</span>
                <h2>Mi brigada</h2>
                <p>Información de solo lectura: dónde estás asignado actualmente.</p>
              </div>
            </div>
            {cargandoMis ? (
              <p className="estado">Consultando tus brigadas.</p>
            ) : misBrigadas.length === 0 ? (
              <p className="re-vacio-seccion">No estás asignado a ninguna brigada activa.</p>
            ) : (
              <ul className="bg-listado">
                {misBrigadas.map((brigada) => (
                  <li className="bg-fila" key={brigada.id_brigada}>
                    <span className="bg-fila-icono"><Icono nombre="escudo" tamano={18} /></span>
                    <span className="re-unidad-datos">
                      <strong>{brigada.nombre}</strong>
                      <small>
                        {etiquetaRolBrigada(brigada.rol_en_brigada)}
                        {" · "}{brigada.estacion || "Sin estación"}
                        {" · Desde "}{brigada.fecha_incorporacion?.split("-").reverse().join("/") || "-"}
                      </small>
                    </span>
                    <span className={`re-estado ${claseEstadoBrigada(brigada.estado_brigada)}`}>
                      <i className="vg-punto" /> {etiquetaEstadoBrigada(brigada.estado_brigada)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="re-kpis">
          <div className="re-kpi re-kpi-oscuro">
            <span className="re-kpi-icono"><Icono nombre="escudo" tamano={20} /></span>
            <span><strong>{kpis.total}</strong><small>Brigadas registradas</small></span>
          </div>
          <div className="re-kpi re-kpi-dorado">
            <span className="re-kpi-icono"><Icono nombre="check" tamano={20} /></span>
            <span><strong>{kpis.disponibles}</strong><small>Disponibles</small></span>
          </div>
          <div className="re-kpi">
            <span className="re-kpi-icono"><Icono nombre="llama" tamano={20} /></span>
            <span><strong>{kpis.operacion}</strong><small>En operación</small></span>
          </div>
          <div className="re-kpi">
            <span className="re-kpi-icono"><Icono nombre="usuario" tamano={20} /></span>
            <span><strong>{kpis.integrantes}</strong><small>Integrantes activos</small></span>
          </div>
        </div>

        <div className="bg-barra">
          <label className="vg-buscar bg-buscar">
            <Icono nombre="buscar" tamano={18} />
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar brigadas, estaciones o estados."
              aria-label="Buscar brigadas"
            />
            {busqueda && (
              <button type="button" className="vg-buscar-limpiar" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda">
                <Icono nombre="cerrar" tamano={15} />
              </button>
            )}
          </label>
          <label className="bg-filtro-estado">
            <span>Ordenar</span>
            <select value={orden} onChange={(evento) => setOrden(evento.target.value)}>
              <option value="nombre_asc">Nombre A-Z</option>
              <option value="nombre_desc">Nombre Z-A</option>
              <option value="estado">Por estado</option>
              <option value="disponibilidad">Por disponibilidad</option>
            </select>
          </label>
          <div className="bg-barra-acciones">
            <Link to="/brigadas/incendios" className="vg-boton-secundario">
              <Icono nombre="incendio" tamano={18} /> <span>Incendios asignados</span>
            </Link>
            {esAdmin && (
              <Link to="/brigadas/nueva" className="vg-boton-principal">
                <Icono nombre="mas" tamano={18} /> <span>Nueva brigada</span>
              </Link>
            )}
          </div>
        </div>

        {error && <p className="aviso">{error}</p>}
        {mensaje && <p className="ok">{mensaje}</p>}

        <div className="re-listado-cabecera">
          <div>
            <h2>Brigadas registradas</h2>
            <p>
              {busqueda
                ? `${filtradas.length} de ${brigadas.length} brigadas coinciden con "${busqueda}"`
                : `${brigadas.length} brigadas en el sistema`}
            </p>
          </div>
        </div>

        {cargando ? (
          <div className="re-estado-carga">Cargando brigadas desde la base de datos.</div>
        ) : filtradas.length > 0 ? (
          <div className="re-listado">
            {filtradas.map((brigada) => (
              <article className="re-card bg-card" key={brigada.id_brigada}>
                <div className="re-card-cuerpo">
                  <div className="re-card-cabecera">
                    <div className="re-card-identidad">
                      <span className="re-card-icono"><Icono nombre="escudo" tamano={24} /></span>
                      <div>
                        <h2>{brigada.nombre}</h2>
                        <p>
                          <Icono nombre="estacion" tamano={14} /> {brigada.estacion || "Sin estación"}
                          {" · "}
                          <Icono nombre="usuario" tamano={14} /> {brigada.total_miembros} integrante{brigada.total_miembros === 1 ? "" : "s"}
                        </p>
                        {brigada.motivo_estado && <p className="bg-motivo">Motivo: {brigada.motivo_estado}</p>}
                        <div className={`bg-cupo${brigada.total_miembros < brigada.min_integrantes ? " bg-cupo-bajo" : ""}`}>
                          <span>
                            Cupo {brigada.total_miembros}/{brigada.max_integrantes}
                            {" · mín. "}{brigada.min_integrantes}
                            {brigada.total_miembros < brigada.min_integrantes ? " · Por debajo del mínimo" : ""}
                            {brigada.total_miembros >= brigada.max_integrantes ? " · Completa" : ""}
                          </span>
                          <span className="bg-cupo-barra">
                            <i style={{ width: `${Math.min(100, Math.round((brigada.total_miembros / brigada.max_integrantes) * 100))}%` }} />
                          </span>
                          {!brigada.disponible && brigada.motivo_no_disponible && (
                            <small className="bg-motivo-no-disponible">
                              No se puede asignar: {brigada.motivo_no_disponible}
                            </small>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="re-card-lado">
                      <span className={`re-estado ${claseEstadoBrigada(brigada.estado)}`}>
                        <i className="vg-punto" /> {etiquetaEstadoBrigada(brigada.estado)}
                      </span>
                      <span className={`re-badge-disponible${brigada.disponible ? "" : " bg-no-disponible"}`}
                        title={brigada.motivo_no_disponible || "Disponible para asignación"}>
                        <i className="vg-punto" /> {brigada.disponible ? "Disponible" : "No disponible"}
                      </span>
                      <span className={`bg-cump${brigada.total_miembros >= brigada.min_integrantes ? "" : " bg-cump-incompleta"}`}>
                        {brigada.total_miembros >= brigada.min_integrantes
                          ? "Cuadrilla completa"
                          : `Incompleta · faltan ${brigada.min_integrantes - brigada.total_miembros}`}
                      </span>
                    </div>
                  </div>

                  <div className="bg-acciones">
                    <button type="button" className="re-boton-gestionar" onClick={() => setGestionando(brigada)}>
                      Gestionar <Icono nombre="chevronDerecha" tamano={16} />
                    </button>
                    <button type="button" className="vg-boton-secundario" onClick={() => setEditorEstado(brigada)}>
                      Cambiar estado
                    </button>
                    {esAdmin && (
                      <>
                        <Link to={`/brigadas/${brigada.id_brigada}/editar`} className="vg-boton-secundario">
                          Editar
                        </Link>
                        {brigada.estado === "DISUELTA" ? (
                          <button type="button" className="vg-boton-secundario" onClick={() => reactivar(brigada)}>
                            Reactivar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="vg-boton-secundario"
                            onClick={() => setEditorEstado({ ...brigada, estado: "DISUELTA" })}
                          >
                            Desactivar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="re-estado-carga">
            <Icono nombre="buscar" tamano={30} />
            <h3>Sin brigadas que coincidan</h3>
            <p>Ajusta el buscador para ver otras brigadas.</p>
          </div>
        )}
      </div>

      {gestionando && (
        <ModalGestionBrigada
          brigada={gestionando}
          esGestor={esGestor}
          onCerrar={() => setGestionando(null)}
          onCambios={cargar}
        />
      )}
      {editorEstado && (
        <ModalCambioEstadoBrigada
          item={editorEstado}
          guardando={guardando}
          onCancelar={() => setEditorEstado(null)}
          onGuardar={guardarEstado}
        />
      )}
    </AppLayout>
  );
}
