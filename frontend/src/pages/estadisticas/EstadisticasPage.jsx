import { useEffect, useState } from "react";

import AppLayout from "../../components/layout/AppLayout";

import FiltrosEstadisticas from "./FiltrosEstadisticas";
import IndicadoresEstadisticas from "./IndicadoresEstadisticas";
import GraficosEstadisticas from "./GraficosEstadisticas";
import GenerarInforme from "./GenerarInforme";
import HistorialInformes from "./HistorialInformes";
import DetalleInforme from "./DetalleInforme";

import { consultarEstadisticas } from "../../services/estadisticasService";

import "./EstadisticasPage.css";

const PESTANAS = [
  {
    id: "estadisticas",
    nombre: "Estadísticas",
  },
  {
    id: "generar",
    nombre: "Generar informe",
  },
  {
    id: "historial",
    nombre: "Historial de informes",
  },
];

export default function EstadisticasPage() {
  const [pestanaActiva, setPestanaActiva] =
    useState("estadisticas");
    const [informeSeleccionado, setInformeSeleccionado] = useState(null);

  const [datos, setDatos] = useState(null);
  const [filtros, setFiltros] = useState({});
  const [filtrosExitosos, setFiltrosExitosos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [actualizado, setActualizado] = useState(null);

  // Consultar estadisticas cuando cambien los filtros
  useEffect(() => {
    let activo = true;

    async function cargarEstadisticas() {
      setCargando(true);
      setError("");

      try {
        const resultado =
          await consultarEstadisticas(filtros);

        if (activo) {
  setDatos(resultado);
  setFiltrosExitosos({ ...filtros });
  setActualizado(new Date());
}
      } catch (err) {
        if (activo) {

          setError(
            err.message &&
            err.message !== "[object Object]"
              ? err.message
              : "No se pudieron obtener las estadísticas"
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    cargarEstadisticas();

    return () => {
      activo = false;
    };
  }, [filtros]);

  function cambiarPestana(pestana) {
  setInformeSeleccionado(null);
  setPestanaActiva(pestana);
}

  // Aplicar los filtros seleccionados
  function aplicarFiltros(nuevosFiltros) {
    setFiltros({ ...nuevosFiltros });
  }

  // Actualizar los datos manualmente
  function actualizarEstadisticas() {
    setFiltros((anteriores) => ({
      ...anteriores,
    }));
  }

  return (
    <AppLayout ancha suelta>

      <main className="est-pagina">

        {/* Encabezado principal */}

        <header className="est-encabezado">
          <div>
            <span className="est-subtitulo">
              MÓDULO DE ANÁLISIS
            </span>

            <h1>Estadísticas e informes</h1>

            <p>
              Consulta, análisis y generación de informes
              sobre los incidentes registrados en el
              sistema VIGIA.
            </p>
          </div>

          {pestanaActiva === "estadisticas" && (
            <button
              type="button"
              className="est-boton-primario"
              onClick={actualizarEstadisticas}
              disabled={cargando}
            >
              {cargando
                ? "Actualizando..."
                : "Actualizar datos"}
            </button>
          )}
        </header>

        {/* Navegacion interna */}

        <nav
          className="est-pestanas"
          aria-label="Secciones de estadísticas e informes"
        >
          {PESTANAS.map((pestana) => (
            <button
              key={pestana.id}
              type="button"
              className={`est-pestana ${
                pestanaActiva === pestana.id
                  ? "est-pestana-activa"
                  : ""
              }`}
              aria-pressed={
                pestanaActiva === pestana.id
              }
              onClick={() =>
  cambiarPestana(pestana.id)
}
            >
              {pestana.nombre}
            </button>
          ))}
        </nav>

        {/* Seccion de estadisticas */}

        {pestanaActiva === "estadisticas" && (
          <div className="est-contenido">

            <FiltrosEstadisticas
             onAplicar={aplicarFiltros}
             cargando={cargando}
             filtrosAplicados={filtros}
            />

            {cargando && (
              <div
                className="est-panel est-cargando"
                role="status"
              >
                <span className="est-spinner" />

                <p>
                  Consultando estadísticas...
                </p>
              </div>
            )}

            {!cargando && error && (
              <div
                className="est-panel est-error"
                role="alert"
              >
                <h3>Error de consulta</h3>

                <p>{error}</p>

                {datos && (
  <p>
    Se mantienen las estadísticas de la última
    consulta exitosa. Los nuevos filtros no
    pudieron aplicarse.
  </p>
)}

                <button
                  type="button"
                  className="est-boton-primario"
                  onClick={actualizarEstadisticas}
                >
                  Reintentar
                </button>
              </div>
            )}

            {datos && (
              <>

                {datos.sin_datos && (
                  <div
                    className="est-panel est-sin-datos"
                    role="status"
                  >
                    <h3>No se encontraron incidentes</h3>

                    <p>
                      No existen registros para los
                      filtros seleccionados. Modifica
                      los criterios o limpia los filtros.
                    </p>
                  </div>
                )}

                <IndicadoresEstadisticas
                  datos={datos}
                />

                {(error || cargando) && (
  <div className="est-panel est-aviso">
    <strong>Filtros de los datos mostrados:</strong>

    <p>
      Desde: {filtrosExitosos.fecha_inicio || "Sin límite"}
      {" | "}
      Hasta: {filtrosExitosos.fecha_fin || "Sin límite"}
      {" | "}
      Zona: {filtrosExitosos.id_zona || "Todas"}
      {" | "}
      Riesgo: {filtrosExitosos.nivel_riesgo || "Todos"}
    </p>
  </div>
)}

                <GraficosEstadisticas
                  datos={datos}
                />

                {actualizado && (
                  <footer className="est-actualizacion">
                    Última actualización:{" "}
                    {actualizado.toLocaleString("es-BO", {
                      timeZone: "America/La_Paz",
                    })}
                  </footer>
                )}

              </>
            )}

          </div>
        )}

        {/* Seccion de generacion de informes */}

{pestanaActiva === "generar" && (
  <div className="est-contenido">
    <GenerarInforme />
  </div>
)}

        {/* Seccion de historial */}

{pestanaActiva === "historial" && (
  <div className="est-contenido">

    {informeSeleccionado === null ? (

      <HistorialInformes
        onVerDetalle={setInformeSeleccionado}
      />

    ) : (

      <DetalleInforme
        key={informeSeleccionado}
        idReporte={informeSeleccionado}
        onVolver={() => setInformeSeleccionado(null)}
      />

    )}

  </div>
)}

      </main>

    </AppLayout>
  );
}
