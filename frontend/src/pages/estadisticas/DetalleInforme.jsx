import { useEffect, useRef, useState } from "react";

import VisorInforme from "./VisorInforme";
import IndicadoresEstadisticas from "./IndicadoresEstadisticas";
import GraficosEstadisticas from "./GraficosEstadisticas";

import {
  obtenerDetalleInforme,
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


function formatearTamano(bytes) {

  if (bytes == null) {
    return "No disponible";
  }

  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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


export default function DetalleInforme({
  idReporte,
  onVolver,
}) {

  const [informe, setInforme] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState("");

  const [error, setError] = useState("");
  const [errorDescarga, setErrorDescarga] = useState("");

  const [actualizacion, setActualizacion] = useState(0);

  const descargaEnCurso = useRef(false);


  // Consultar el detalle del informe
  useEffect(() => {

    let activo = true;

    async function cargarDetalle() {

      setCargando(true);
      setError("");
      setErrorDescarga("");
      setInforme(null);

      try {

        const resultado = await obtenerDetalleInforme(
          idReporte
        );

        if (activo) {
          setInforme(resultado);
        }

      } catch (err) {

        if (activo) {

          setError(
            err.message &&
            err.message !== "[object Object]"
              ? err.message
              : "No se pudo consultar el informe"
          );

        }

      } finally {

        if (activo) {
          setCargando(false);
        }

      }
    }

    cargarDetalle();

    return () => {
      activo = false;
    };

  }, [idReporte, actualizacion]);


  // Exportar el informe en el formato solicitado
  async function descargarDocumento(formato) {

    if (
      !informe ||
      !informe.formatos_exportacion?.includes(formato) ||
      descargaEnCurso.current
    ) {
      return;
    }

    descargaEnCurso.current = true;

    setDescargando(formato);
    setErrorDescarga("");

    try {

      await exportarInforme(
        informe.id_reporte,
        formato,
      );

    } catch {

      setErrorDescarga(
        `No se pudo exportar el informe en ${formato}. ` +
        "Puedes volver a intentarlo sin modificar el informe."
      );

    } finally {

      descargaEnCurso.current = false;
      setDescargando("");

    }
  }


  // Recuperar el contenido original almacenado
  const datosOriginales = informe?.contenido?.datos;

  const esEstructurado = Boolean(
    informe?.contenido_disponible && datosOriginales
  );

  const filtrosOriginales = datosOriginales?.filtros || {};


  return (

    <section className="est-panel est-detalle">

      <header className="est-panel-cabecera">

        <h2>Detalle del informe</h2>

        <p>
          Consulta el contenido original del informe
          almacenado en el historial.
        </p>

      </header>


      <div className="est-detalle-navegacion">

        <button
          type="button"
          className="vg-boton-secundario"
          onClick={onVolver}
          disabled={!!descargando}
        >

          Volver al historial

        </button>

      </div>


      {/* Estado de carga */}

      {cargando && (

        <div
          className="est-cargando"
          role="status"
        >

          <span className="est-spinner" />

          <p>Consultando informe...</p>

        </div>

      )}


      {/* Error de consulta */}

      {!cargando && error && (

        <div className="est-error" role="alert">

          <p>{error}</p>

          <button
            type="button"
            className="est-boton-primario"
            onClick={() =>
              setActualizacion(
                (anterior) => anterior + 1
              )
            }
          >

            Reintentar

          </button>

        </div>

      )}


      {/* Informacion del informe */}

      {!cargando && !error && informe && (

        <>

          <div className="est-detalle-cabecera">

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

              {informe.tipo_reporte === "GENERAL"
                ? "Informe general"
                : informe.tipo_reporte}

              {" "}#{informe.id_reporte}

            </h3>

          </div>


          {/* Datos generales */}

          <div className="est-detalle-bloque">

            <h3>Información general</h3>

            <div className="est-detalle-rejilla">

              <div className="est-detalle-campo">

                <span>Identificador</span>

                <strong>
                  #{informe.id_reporte}
                </strong>

              </div>


              <div className="est-detalle-campo">

                <span>Tipo de informe</span>

                <strong>
                  {informe.tipo_reporte === "GENERAL"
                    ? "Informe general"
                    : informe.tipo_reporte}
                </strong>

              </div>


              <div className="est-detalle-campo">

                <span>Generado por</span>

                <strong>
                  {informe.contenido?.nombre_administrador ||
                    informe.nombre_administrador ||
                    "No disponible"}
                </strong>

              </div>


              <div className="est-detalle-campo">

                <span>Fecha de generación</span>

                <strong>
                  {formatearFecha(
                    informe.fecha_generacion
                  )}
                </strong>

              </div>


              <div className="est-detalle-campo">

                <span>Periodo</span>

                <strong>
                  {informe.periodo}
                </strong>

              </div>


              <div className="est-detalle-campo">

                <span>Formato de almacenamiento</span>

                <strong>
                  {nombreFormato(informe.formato)}
                </strong>

              </div>

            </div>

          </div>


          {/* Informacion del almacenamiento */}

          <div className="est-detalle-bloque">

            <h3>Información del contenido</h3>

            <div className="est-detalle-rejilla">

              <div className="est-detalle-campo">

                <span>Estado del contenido</span>

                <strong>
                  {esEstructurado ||
                  informe.archivo_disponible
                    ? "Disponible"
                    : "No disponible"}
                </strong>

              </div>


              <div className="est-detalle-campo">

                <span>Almacenamiento</span>

                <strong>
                  {esEstructurado
                    ? "Contenido estructurado"
                    : informe.archivo_disponible
                      ? "Archivo original"
                      : "No disponible"}
                </strong>

              </div>


              <div className="est-detalle-campo">

                <span>Formatos de exportación</span>

                <strong>
                  {informe.formatos_exportacion?.length
                    ? informe.formatos_exportacion
                        .map(nombreFormato)
                        .join(" / ")
                    : "No disponibles"}
                </strong>

              </div>


              {esEstructurado && (

                <div className="est-detalle-campo">

                  <span>Versión del contenido</span>

                  <strong>
                    {informe.contenido.version_contenido}
                  </strong>

                </div>

              )}


              {!esEstructurado &&
                informe.archivo_disponible && (

                  <>

                    <div className="est-detalle-campo">

                      <span>Nombre del archivo</span>

                      <strong>
                        {informe.archivo?.nombre_archivo ||
                          "No disponible"}
                      </strong>

                    </div>


                    <div className="est-detalle-campo">

                      <span>Tamaño del documento</span>

                      <strong>
                        {formatearTamano(
                          informe.archivo?.tamano_bytes
                        )}
                      </strong>

                    </div>

                  </>

              )}

            </div>

          </div>


          {/* Filtros originales del informe estructurado */}

          {esEstructurado && (

            <div className="est-detalle-bloque">

              <h3>Filtros aplicados</h3>

              <div className="est-detalle-rejilla">

                <div className="est-detalle-campo">

                  <span>Fecha de inicio</span>

                  <strong>
                    {filtrosOriginales.fecha_inicio ||
                      "Sin límite inicial"}
                  </strong>

                </div>


                <div className="est-detalle-campo">

                  <span>Fecha de finalización</span>

                  <strong>
                    {filtrosOriginales.fecha_fin ||
                      "Sin límite final"}
                  </strong>

                </div>


                <div className="est-detalle-campo">

                  <span>Zona de riesgo</span>

                  <strong>
                    {filtrosOriginales.id_zona != null
                      ? datosOriginales.por_zona?.find(
                          (zona) =>
                            String(zona.id_zona) ===
                            String(filtrosOriginales.id_zona)
                        )?.nombre ||
                        `Zona #${filtrosOriginales.id_zona}`
                      : "Todas las zonas"}
                  </strong>

                </div>


                <div className="est-detalle-campo">

                  <span>Nivel de riesgo</span>

                  <strong>
                    {filtrosOriginales.nivel_riesgo ||
                      "Todos los niveles"}
                  </strong>

                </div>

              </div>

            </div>

          )}


          {/* Visualizar contenido estructurado */}

          {esEstructurado && (

            <>

              <div className="est-detalle-bloque">

                <h3>Indicadores del informe</h3>

                <IndicadoresEstadisticas
                  datos={datosOriginales}
                />

              </div>


              <div className="est-detalle-bloque">

                <h3>Gráficos del informe</h3>

                <GraficosEstadisticas
                  datos={datosOriginales}
                />

              </div>

            </>

          )}


          {/* Visualizar documentos anteriores */}

          {!esEstructurado &&
            informe.archivo_disponible && (

              <VisorInforme
                idReporte={informe.id_reporte}
                formato={informe.formato}
              />

          )}


          {/* Contenido no disponible */}

          {!esEstructurado &&
            !informe.archivo_disponible && (

              <div
                className="est-sin-datos"
                role="status"
              >

                <h3>Contenido no disponible</h3>

                <p>
                  No se encontró el contenido original
                  de este informe.
                </p>

              </div>

          )}


          {/* Exportacion del informe */}

          <div className="est-detalle-bloque">

            <h3>Exportar informe</h3>

            <p className="est-aviso">

              {esEstructurado
                ? "La exportación utiliza los datos originales " +
                  "registrados al generar el informe, sin " +
                  "recalcular las estadísticas."
                : "La descarga recupera el documento original " +
                  "almacenado al momento de su generación."}

            </p>


            {errorDescarga && (

              <p className="est-error" role="alert">

                {errorDescarga}

              </p>

            )}


            <div className="est-filtros-acciones">

              {informe.formatos_exportacion?.includes("PDF") && (

                <button
                  type="button"
                  className="est-boton-primario"
                  onClick={() =>
                    descargarDocumento("PDF")
                  }
                  disabled={!!descargando}
                >

                  {descargando === "PDF"
                    ? "Exportando PDF..."
                    : "Exportar PDF"}

                </button>

              )}


              {informe.formatos_exportacion?.includes("EXCEL") && (

                <button
                  type="button"
                  className="vg-boton-secundario"
                  onClick={() =>
                    descargarDocumento("EXCEL")
                  }
                  disabled={!!descargando}
                >

                  {descargando === "EXCEL"
                    ? "Exportando Excel..."
                    : "Exportar Excel"}

                </button>

              )}


              {!informe.formatos_exportacion?.length && (

                <p className="est-aviso">

                  No existen formatos de exportación
                  disponibles para este informe.

                </p>

              )}

            </div>

          </div>

        </>

      )}

    </section>

  );
}