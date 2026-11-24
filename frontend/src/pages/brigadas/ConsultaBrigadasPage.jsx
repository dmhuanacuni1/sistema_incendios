import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ModalCambioEstadoBrigada from "../../components/brigadas/ModalCambioEstadoBrigada";
import ModalGestionBrigada from "../../components/brigadas/ModalGestionBrigada";
import {
  ESTADOS_BRIGADA,
  claseEstadoBrigada,
  etiquetaEstadoBrigada,
} from "../../components/brigadas/estadosBrigada";
import AppLayout from "../../components/layout/AppLayout";
import Icono from "../../components/layout/IconosVigia";
import { useAuth } from "../../hooks/useAuth";
import * as brigadasService from "../../services/brigadasService";

export default function ConsultaBrigadasPage() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "ADMINISTRADOR";
  const esGestor = esAdmin || usuario?.rol === "OPERADOR";

  const [filtro, setFiltro] = useState("TODOS");
  const [estado, setEstado] = useState("");
  const [orden, setOrden] = useState("nombre_asc");
  const [brigadas, setBrigadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [editor, setEditor] = useState(null);
  const [gestionando, setGestionando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const filtros = { estado, orden };
      if (filtro === "DISPONIBLE" || filtro === "NO_DISPONIBLE") {
        filtros.disponibilidad = filtro;
      }
      setBrigadas(await brigadasService.listar(filtros));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [filtro, estado, orden]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardarEstado(item, nuevoEstado, motivo) {
    setError("");
    setMensaje("");
    setGuardando(true);
    try {
      let respuesta;
      if (nuevoEstado === "DISUELTA") {
        respuesta = await brigadasService.desactivar(item.id_brigada, motivo);
      } else if (item.estado === "DISUELTA" && nuevoEstado === "ACTIVA") {
        respuesta = await brigadasService.reactivar(item.id_brigada, motivo);
      } else {
        respuesta = await brigadasService.cambiarEstado(item.id_brigada, nuevoEstado, motivo);
      }
      setMensaje(`${respuesta.mensaje} · ${item.nombre}`);
      setEditor(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <AppLayout ancha suelta>
      <section className="cuenta-tarjeta cuenta-tarjeta-ancha">
        <h1>Consultar brigadas</h1>
        <p className="bajada">
          Estado, estación, integrantes y disponibilidad de cada cuadrilla. La disponibilidad se
          deriva del estado <code>ACTIVA</code> y de la ausencia de asignaciones abiertas.
        </p>

        <div className="filtros">
          {[
            ["TODOS", "Todas"],
            ["DISPONIBLE", "Solo disponibles"],
            ["NO_DISPONIBLE", "No disponibles"],
          ].map(([codigo, etiqueta]) => (
            <button
              type="button"
              key={codigo}
              className={`boton ${filtro === codigo ? "boton-oscuro" : ""}`}
              onClick={() => setFiltro(codigo)}
            >
              {etiqueta}
            </button>
          ))}
          <label className="bg-filtro-estado">
            <span>Estado</span>
            <select value={estado} onChange={(evento) => setEstado(evento.target.value)}>
              <option value="">Todos los estados</option>
              {ESTADOS_BRIGADA.map(([codigo, etiqueta]) => (
                <option key={codigo} value={codigo}>{etiqueta}</option>
              ))}
            </select>
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
        </div>

        {error && <p className="aviso">{error}</p>}
        {mensaje && <p className="ok">{mensaje}</p>}
        {cargando && <p className="estado">Cargando brigadas.</p>}
        {!cargando && brigadas.length === 0 && (
          <p className="estado">
            No hay brigadas con estos filtros.{" "}
            {esAdmin && <Link to="/brigadas/nueva">Registrar la primera brigada</Link>}.
          </p>
        )}

        {!cargando && brigadas.length > 0 && (
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Brigada</th>
                  <th>Estación</th>
                  <th>Estado</th>
                  <th>Disponibilidad</th>
                  <th>Integrantes</th>
                  <th>Cupo (mín./máx.)</th>
                  <th>Motivo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {brigadas.map((brigada) => (
                  <tr key={brigada.id_brigada}>
                    <td data-etiqueta="Brigada">{brigada.nombre}</td>
                    <td data-etiqueta="Estación">{brigada.estacion || "-"}</td>
                    <td data-etiqueta="Estado">
                      <span className={`re-estado ${claseEstadoBrigada(brigada.estado)}`}>
                        <i className="vg-punto" /> {etiquetaEstadoBrigada(brigada.estado)}
                      </span>
                    </td>
                    <td data-etiqueta="Disponibilidad">
                      {brigada.disponible ? (
                        "Disponible"
                      ) : (
                        <>
                          No disponible
                          {brigada.motivo_no_disponible && (
                            <small className="bg-motivo-no-disponible">
                              {brigada.motivo_no_disponible}
                            </small>
                          )}
                        </>
                      )}
                    </td>
                    <td data-etiqueta="Integrantes">{brigada.total_miembros}</td>
                    <td data-etiqueta="Cupo">
                      {brigada.min_integrantes} / {brigada.max_integrantes}
                    </td>
                    <td data-etiqueta="Motivo">{brigada.motivo_estado || "-"}</td>
                    <td>
                      <div className="bg-tabla-acciones">
                        <button type="button" className="boton boton-oscuro" onClick={() => setGestionando(brigada)}>
                          Integrantes
                        </button>
                        <button type="button" className="boton" onClick={() => setEditor(brigada)}>
                          Estado
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editor && (
        <ModalCambioEstadoBrigada
          item={editor}
          guardando={guardando}
          onCancelar={() => setEditor(null)}
          onGuardar={guardarEstado}
        />
      )}
      {gestionando && (
        <ModalGestionBrigada
          brigada={gestionando}
          esGestor={esGestor}
          onCerrar={() => setGestionando(null)}
          onCambios={cargar}
        />
      )}
      {esAdmin && (
        <p className="estado bg-pie-consulta">
          <Icono nombre="escudo" tamano={14} /> Las altas, ediciones y bajas las realiza el
          Administrador; Operador y Bombero pueden actualizar el estado de la brigada.
        </p>
      )}
    </AppLayout>
  );
}
