import { useEffect, useRef, useState } from "react";

import {
  listarInformes,
  exportarInforme,
} from "../../services/informesService";


function formatearFecha(fecha) {

  if (!fecha) {
    return "Sin fecha";
  }

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return "Fecha no disponible";
  }

  return valor.toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
  });
}


function nombreTipo(tipo) {

  if (tipo === "GENERAL") {
    return "Informe general";
  }

  return tipo || "Informe";
}


function nombreFormato(formato) {

  if (formato === "JSON") {
    return "Estructurado";
  }

  if (formato === "EXCEL") {
    return "Excel";
  }

  return formato || "No disponible";
}


export default function HistorialInformes({
  onVerDetalle,
}) {

  const [informes, setInformes] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [errorDescarga, setErrorDescarga] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [formato, setFormato] = useState("");

  const [actualizacion, setActualizacion] = useState(0);

  const [descargando, setDescargando] = useState(null);

  const descargaEnCurso = useRef(false);


  // Consultar historial
  useEffect(() => {

    let activo = true;

    async function cargarHistorial() {

      setCargando(true);
      setError("");

      try {

        const resultado = await listarInformes();

        if (activo) {
          setInformes(resultado || []);
        }

      } catch (err) {

        if (activo) {

          setError(
            err.message &&
            err.message !== "[object Object]"
              ? err.message
              : "No se pudo consultar el historial"
          );

        }

      } finally {

        if (activo) {
          setCargando(false);
        }

      }
    }

    cargarHistorial();

    return () => {
      activo = false;
    };

  }, [actualizacion]);


  // Actualizar historial
  function actualizarHistorial() {

    setErrorDescarga("");

    setActualizacion(
      (anterior) => anterior + 1
    );

  }


  // Exportar informe en el formato solicitado
  async function descargarDocumento(idReporte, formato) {

    if (descargaEnCurso.current) {
      return;
    }

    descargaEnCurso.current = true;

    setDescargando({
      idReporte,
      formato,
    });

    setErrorDescarga("");

    try {

      await exportarInforme(
        idReporte,
        formato,
      );

    } catch {

      setErrorDescarga(
        `No se pudo exportar el informe #${idReporte} ` +
        `en ${formato}. Puedes volver a intentarlo.`
      );

    } finally {

      descargaEnCurso.current = false;

      setDescargando(null);

    }
  }


  // Filtrar informes localmente
  const informesFiltrados = informes.filter(
    (informe) => {

      const texto = busqueda.trim().toLowerCase();

      const contenido = [
        informe.id_reporte,
        informe.tipo_reporte,
        nombreTipo(informe.tipo_reporte),
        informe.nombre_administrador,
        informe.periodo,
        informe.formato,
        nombreFormato(informe.formato),
        formatearFecha(informe.fecha_generacion),
        ...(informe.formatos_exportacion || []),
      ]
        .filter((valor) => valor != null)
        .join(" ")
        .toLowerCase();

      const esBusquedaId = /^#?\d+$/.test(texto);

const coincideBusqueda =
  !texto ||
  (esBusquedaId
    ? String(informe.id_reporte) === texto.replace(/^#/, "")
    : contenido.includes(texto));

      const coincideFormato =
        !formato || informe.formato === formato;

      return coincideBusqueda && coincideFormato;

    }
  );


  // Contabilizar informes con contenido o archivo
  const disponibles = informes.filter(
    (informe) =>
      informe.archivo_disponible ||
      informe.contenido_disponible
  ).length;


  return (

    <section className="est-panel est-historial">

      <header className="est-panel-cabecera">

        <h2>Historial de informes</h2>

        <p>
          Consulta, visualiza y exporta los informes
          generados anteriormente.
        </p>

      </header>


      {/* Indicadores del historial */}

      <div className="est-historial-resumen">

        <div className="est-historial-contador">

          <span>Total de informes</span>

          <strong>{informes.length}</strong>

        </div>

        <div className="est-historial-contador">

          <span>Informes disponibles</span>

          <strong>{disponibles}</strong>

        </div>

      </div>


      {/* Filtros del historial */}

      <div className="est-filtros-rejilla">

        <label className="est-campo">

          <span>Buscar informe</span>

          <input
            type="search"
            placeholder="Buscar por ID, periodo..."
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(evento.target.value)
            }
          />

        </label>


        <label className="est-campo">

          <span>Formato de almacenamiento</span>

          <select
            value={formato}
            onChange={(evento) =>
              setFormato(evento.target.value)
            }
          >

            <option value="">
              Todos los formatos
            </option>

            <option value="JSON">
              Informe estructurado
            </option>

            <option value="PDF">
              PDF original
            </option>

            <option value="EXCEL">
              Excel original
            </option>

          </select>

        </label>

      </div>


      <div className="est-filtros-acciones">

        <button
          type="button"
          className="vg-boton-secundario"
          onClick={() => {
            setBusqueda("");
            setFormato("");
          }}
        >

          Limpiar filtros

        </button>


        <button
          type="button"
          className="est-boton-primario"
          onClick={actualizarHistorial}
          disabled={cargando || descargando !== null}
        >

          {cargando
            ? "Actualizando..."
            : "Actualizar historial"}

        </button>

      </div>


      {/* Estado de carga */}

      {cargando && (

        <div
          className="est-cargando"
          role="status"
        >

          <span className="est-spinner" />

          <p>Consultando historial...</p>

        </div>

      )}


      {/* Error de consulta */}

      {!cargando && error && (

        <div className="est-error" role="alert">

          <p>{error}</p>

          <button
            type="button"
            className="est-boton-primario"
            onClick={actualizarHistorial}
          >

            Reintentar

          </button>

        </div>

      )}


      {/* Error de descarga */}

      {errorDescarga && (

        <p className="est-error" role="alert">

          {errorDescarga}

        </p>

      )}


      {/* Historial vacio */}

      {!cargando &&
        !error &&
        informesFiltrados.length === 0 && (

          <div
            className="est-sin-datos"
            role="status"
          >

            <h3>No se encontraron informes</h3>

            <p>

              {informes.length === 0
                ? "Todavía no existen informes registrados."
                : "No existen informes para los filtros seleccionados."}

            </p>

          </div>

      )}


      {/* Listado de informes */}

      {!cargando &&
        !error &&
        informesFiltrados.length > 0 && (

          <div className="est-historial-lista">

            {informesFiltrados.map((informe) => (

              <article
                className="est-historial-item"
                key={informe.id_reporte}
              >

                <div className="est-historial-info">

                  <span
                    className={
                      `est-formato est-formato-${
                        (informe.formato || "").toLowerCase()
                      }`
                    }
                  >

                    {nombreFormato(informe.formato)}

                  </span>


                  <h3>

                    {nombreTipo(informe.tipo_reporte)}
                    {" "}#{informe.id_reporte}

                  </h3>


                  <p>

                    <strong>Periodo:</strong>{" "}
                    {informe.periodo}

                  </p>


                  <p>

                    <strong>Generado por:</strong>{" "}

                    {informe.nombre_administrador ||
                      "No disponible"}

                  </p>


                  <p>

                    <strong>Fecha:</strong>{" "}

                    {formatearFecha(
                      informe.fecha_generacion
                    )}

                  </p>


                  <p>

                    <strong>Contenido:</strong>{" "}

                    {informe.contenido_disponible
                      ? "Informe estructurado disponible"
                      : informe.archivo_disponible
                        ? "Archivo original disponible"
                        : "No disponible"}

                  </p>


                  <p>

                    <strong>Formatos de exportación:</strong>{" "}

                    {informe.formatos_exportacion?.length
                      ? informe.formatos_exportacion
                          .map(nombreFormato)
                          .join(" / ")
                      : "No disponibles"}

                  </p>

                </div>


                <div className="est-historial-acciones">

                  <button
                    type="button"
                    className="vg-boton-secundario"
                    onClick={() =>
                      onVerDetalle?.(
                        informe.id_reporte
                      )
                    }
                    disabled={
                      !onVerDetalle ||
                      descargando !== null
                    }
                  >

                    Ver detalle

                  </button>


                  {/* Exportar PDF */}

                  {informe.formatos_exportacion?.includes("PDF") && (

                    <button
                      type="button"
                      className="est-boton-primario"
                      onClick={() =>
                        descargarDocumento(
                          informe.id_reporte,
                          "PDF",
                        )
                      }
                      disabled={descargando !== null}
                    >

                      {descargando?.idReporte === informe.id_reporte &&
                      descargando?.formato === "PDF"
                        ? "Exportando PDF..."
                        : "Exportar PDF"}

                    </button>

                  )}


                  {/* Exportar Excel */}

                  {informe.formatos_exportacion?.includes("EXCEL") && (

                    <button
                      type="button"
                      className="est-boton-primario"
                      onClick={() =>
                        descargarDocumento(
                          informe.id_reporte,
                          "EXCEL",
                        )
                      }
                      disabled={descargando !== null}
                    >

                      {descargando?.idReporte === informe.id_reporte &&
                      descargando?.formato === "EXCEL"
                        ? "Exportando Excel..."
                        : "Exportar Excel"}

                    </button>

                  )}

                </div>

              </article>

            ))}

          </div>

      )}

    </section>

  );
}