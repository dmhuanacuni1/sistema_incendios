import { useEffect, useRef, useState } from "react";

import { listarZonas } from "../../services/zonasService";

import {
  generarInformeEstructurado,
  exportarInforme,
  crearIdSolicitud,
} from "../../services/informesService";

import {
  consultarEstadisticas,
} from "../../services/estadisticasService";

import IndicadoresEstadisticas from "./IndicadoresEstadisticas";
import GraficosEstadisticas from "./GraficosEstadisticas";


const FORMULARIO_INICIAL = {
  tipo_reporte: "GENERAL",
  fecha_inicio: "",
  fecha_fin: "",
  id_zona: "",
  nivel_riesgo: "",
};


export default function GenerarInforme() {

  const [formulario, setFormulario] = useState({
    ...FORMULARIO_INICIAL,
  });

  const [zonas, setZonas] = useState([]);
  const [cargandoZonas, setCargandoZonas] = useState(true);
  const [errorZonas, setErrorZonas] = useState("");

  const [generando, setGenerando] = useState(false);
  const [descargando, setDescargando] = useState("");

  const [error, setError] = useState("");
  const [errorExportacion, setErrorExportacion] = useState("");

  const [informe, setInforme] = useState(null);

  const operacionEnCurso = useRef(false);

  const solicitudPendiente = useRef(null);

  const [haySolicitudPendiente, setHaySolicitudPendiente] =
    useState(false);


  // Consultar el catalogo de zonas
  useEffect(() => {

    let activo = true;

    async function cargarZonas() {
      try {
        const respuesta = await listarZonas();

        if (activo) {
          setZonas(respuesta.data || []);
        }

      } catch {

        if (activo) {
          setErrorZonas(
            "No se pudo cargar el catálogo de zonas"
          );
        }

      } finally {

        if (activo) {
          setCargandoZonas(false);
        }

      }
    }

    cargarZonas();

    return () => {
      activo = false;
    };

  }, []);


  // Actualizar los campos del formulario
  function cambiarCampo(evento) {

  if (
    operacionEnCurso.current ||
    solicitudPendiente.current
  ) {
    return;
  }

  const { name, value } = evento.target;

  setFormulario((anteriores) => ({
    ...anteriores,
    [name]: value,
  }));

  setError("");
}


  // Restablecer el formulario
  function limpiarFormulario() {

  if (operacionEnCurso.current) {
    return;
  }

  if (solicitudPendiente.current) {

    const confirmado = window.confirm(
      "Existe una solicitud pendiente de confirmación.\n\n" +
      "Es posible que el informe ya esté registrado.\n\n" +
      "Se recomienda reintentar primero o consultar el historial.\n\n" +
      "¿Deseas descartar la solicitud pendiente?"
    );

    if (!confirmado) {
      return;
    }
  }

  solicitudPendiente.current = null;
  setHaySolicitudPendiente(false);

  setFormulario({
    ...FORMULARIO_INICIAL,
  });

  setError("");
  setErrorExportacion("");
  setInforme(null);
}


  // Generar y almacenar el informe estructurado
  async function enviarFormulario(evento) {

  evento.preventDefault();

  if (operacionEnCurso.current) {
    return;
  }

  setError("");
  setErrorExportacion("");

  if (
    formulario.fecha_inicio &&
    formulario.fecha_fin &&
    formulario.fecha_inicio > formulario.fecha_fin
  ) {

    setError(
      "La fecha de inicio no puede ser mayor a la fecha final"
    );

    return;
  }

  operacionEnCurso.current = true;
  setGenerando(true);

  try {

    // Recuperar una solicitud pendiente
    let solicitud = solicitudPendiente.current;

    // Preparar una solicitud nueva solamente si no existe otra
    if (!solicitud) {

      const estadisticas = await consultarEstadisticas({
        fecha_inicio: formulario.fecha_inicio,
        fecha_fin: formulario.fecha_fin,
        id_zona: formulario.id_zona,
        nivel_riesgo: formulario.nivel_riesgo,
      });

      if (estadisticas.sin_datos) {

        setError(
          "No existen incidentes para los filtros seleccionados"
        );

        return;
      }

      // Solicitar confirmacion
      const confirmado = window.confirm(
        `Se generará un informe con ` +
        `${estadisticas.total_incidentes} incidente(s) ` +
        `en la consulta preliminar.\n\n` +
        "El informe se almacenará en el historial.\n\n" +
        "Podrás visualizarlo y exportarlo posteriormente " +
        "en PDF o Excel.\n\n" +
        "¿Deseas continuar?"
      );

      if (!confirmado) {
        return;
      }

      // Preparar los parametros originales
      const datos = {
        tipo_reporte: formulario.tipo_reporte,

        fecha_inicio:
          formulario.fecha_inicio || null,

        fecha_fin:
          formulario.fecha_fin || null,

        id_zona: formulario.id_zona
          ? Number(formulario.id_zona)
          : null,

        nivel_riesgo:
          formulario.nivel_riesgo || null,
      };

      // Crear el UUID una sola vez
      solicitud = {
        idSolicitud: crearIdSolicitud(),
        datos,
      };

      // Conservar la solicitud hasta confirmar el resultado
      solicitudPendiente.current = solicitud;

      setHaySolicitudPendiente(true);
    }

    // Generar o recuperar el informe existente
    const resultado = await generarInformeEstructurado(
      solicitud.datos,
      solicitud.idSolicitud
    );

    // Mostrar el informe confirmado
    setInforme(resultado);

    // Liberar la solicitud solamente despues del exito
    solicitudPendiente.current = null;

    setHaySolicitudPendiente(false);

  } catch (err) {

    if (solicitudPendiente.current) {

      setError(
        "No se pudo confirmar la generación del informe. " +
        "Pulsa Reintentar solicitud para recuperar o " +
        "completar la misma operación sin duplicarla."
      );

    } else {

      setError(
        err.message &&
        err.message !== "[object Object]"
          ? err.message
          : "No se pudo preparar el informe."
      );
    }

  } finally {

    operacionEnCurso.current = false;

    setGenerando(false);
  }
}


  // Exportar el informe en el formato seleccionado
  async function descargarDocumento(formato) {

    if (!informe || operacionEnCurso.current) {
      return;
    }

    operacionEnCurso.current = true;

    setDescargando(formato);
    setErrorExportacion("");

    try {

      await exportarInforme(
        informe.id_reporte,
        formato,
      );

    } catch {

      setErrorExportacion(
        `No se pudo exportar el informe en ${formato}. ` +
        "Puedes volver a intentarlo sin generar otro informe."
      );

    } finally {

      operacionEnCurso.current = false;

      setDescargando("");
    }
  }


  return (

    <section className="est-panel est-filtros">

      <header className="est-panel-cabecera">

        <h2>Generación de informes</h2>

        <p>
          Configura los parámetros para generar
          un informe estadístico de incidentes.
        </p>

      </header>


      <form onSubmit={enviarFormulario}>

        <div className="est-filtros-rejilla">

          {/* Tipo de informe */}

          <label className="est-campo">

            <span>Tipo de informe</span>

            <select
              name="tipo_reporte"
              value={formulario.tipo_reporte}
              onChange={cambiarCampo}
              disabled={
                generando ||
                !!descargando ||
                haySolicitudPendiente
            }
            >

              <option value="GENERAL">
                Informe general
              </option>

            </select>

          </label>


          {/* Fecha inicial */}

          <label className="est-campo">

            <span>Fecha de inicio</span>

            <input
              type="date"
              name="fecha_inicio"
              value={formulario.fecha_inicio}
              onChange={cambiarCampo}
              disabled={
                generando ||
                !!descargando ||
                haySolicitudPendiente
            }
            />

          </label>


          {/* Fecha final */}

          <label className="est-campo">

            <span>Fecha de finalización</span>

            <input
              type="date"
              name="fecha_fin"
              value={formulario.fecha_fin}
              onChange={cambiarCampo}
              disabled={
                generando ||
                !!descargando ||
                haySolicitudPendiente
            }
            />

          </label>


          {/* Zona de riesgo */}

          <label className="est-campo">

            <span>Zona de riesgo</span>

            <select
              name="id_zona"
              value={formulario.id_zona}
              onChange={cambiarCampo}
              disabled={
                generando ||
                !!descargando ||
                cargandoZonas ||
                !!errorZonas
              }
            >

              <option value="">
                {cargandoZonas
                  ? "Cargando zonas..."
                  : "Todas las zonas"}
              </option>

              {zonas.map((zona) => (

                <option
                  key={zona.id_zona}
                  value={zona.id_zona}
                >
                  {zona.nombre}
                </option>

              ))}

            </select>

          </label>


          {/* Nivel de riesgo */}

          <label className="est-campo">

            <span>Nivel de riesgo</span>

            <select
              name="nivel_riesgo"
              value={formulario.nivel_riesgo}
              onChange={cambiarCampo}
              disabled={
                generando ||
                !!descargando ||
                haySolicitudPendiente ||
                cargandoZonas ||
                !!errorZonas
            }
            >

              <option value="">
                Todos los niveles
              </option>

              <option value="BAJO">Bajo</option>

              <option value="MEDIO">Medio</option>

              <option value="ALTO">Alto</option>

              <option value="EXTREMO">Extremo</option>

            </select>

          </label>

        </div>


        {/* Informacion del almacenamiento */}

        <p className="est-aviso">

          El informe generado se almacenará automáticamente
          en el historial. Podrás visualizar su contenido
          y exportarlo opcionalmente en PDF o Excel.

        </p>


        {errorZonas && (

          <p className="est-aviso" role="status">
            {errorZonas}
          </p>

        )}


        {error && (

          <p className="est-error" role="alert">
            {error}
          </p>

        )}

        {haySolicitudPendiente && (

  <p className="est-aviso" role="status">

    Existe una solicitud pendiente de confirmación.
    Si ocurre un error, puedes reintentar la misma
    operación sin generar informes duplicados.

  </p>

)}


        {/* Acciones */}

        <div className="est-filtros-acciones">

          <button
            type="button"
            className="vg-boton-secundario"
            onClick={limpiarFormulario}
            disabled={generando || !!descargando}
          >

            Limpiar formulario

          </button>


          <button
  type="submit"
  className="est-boton-primario"
  disabled={
    generando ||
    !!descargando ||
    (
      !haySolicitudPendiente &&
      (cargandoZonas || !!errorZonas)
    )
  }
>

  {generando
    ? "Procesando informe..."
    : haySolicitudPendiente
      ? "Reintentar solicitud"
      : "Generar informe"}

</button>

        </div>

      </form>


      {/* Resultado de la generacion */}

      {informe && (

        <section className="est-informe-resultado">

          <h3 role="status">

  {informe.solicitud_reutilizada
    ? "Informe existente recuperado correctamente"
    : "Informe generado correctamente"}

</h3>

          <p>

            El informe se encuentra almacenado
            en el historial. Los datos mostrados
            corresponden al contenido registrado
            en el momento de su generación.

          </p>


          <div className="est-informe-datos">

            <p>
              <strong>Identificador:</strong>{" "}
              #{informe.id_reporte}
            </p>

            <p>
              <strong>Tipo de informe:</strong>{" "}
              {informe.tipo_reporte === "GENERAL"
                ? "Informe general"
                : informe.tipo_reporte}
            </p>

            <p>
              <strong>Periodo:</strong>{" "}
              {informe.periodo}
            </p>

            <p>
              <strong>Administrador:</strong>{" "}
              {informe.contenido?.nombre_administrador
                || informe.nombre_administrador
                || "No disponible"}
            </p>

            <p>
              <strong>Fecha de generación:</strong>{" "}
              {informe.fecha_generacion
                ? new Date(
                    informe.fecha_generacion
                  ).toLocaleString("es-BO", {
                    timeZone: "America/La_Paz",
                  })
                : "No disponible"}
            </p>

            <p>
              <strong>Almacenamiento:</strong>{" "}
              Informe registrado
            </p>

          </div>


          {/* Visualizacion del contenido original */}

          {informe.contenido?.datos && (

            <>

              <h3>Indicadores del informe</h3>

              <IndicadoresEstadisticas
                datos={informe.contenido.datos}
              />

              <h3>Gráficos del informe</h3>

              <GraficosEstadisticas
                datos={informe.contenido.datos}
              />

            </>

          )}


          {/* Exportacion opcional */}

          <h3>Exportar informe</h3>

          <p>

            Selecciona el formato en el que deseas
            descargar el informe. Esta operación
            no modifica los datos originales.

          </p>


          {errorExportacion && (

            <p className="est-error" role="alert">
              {errorExportacion}
            </p>

          )}


          <div className="est-filtros-acciones">

            <button
              type="button"
              className="est-boton-primario"
              onClick={() => descargarDocumento("PDF")}
              disabled={
                !!descargando ||
                generando ||
                !informe.formatos_exportacion?.includes("PDF")
              }
            >

              {descargando === "PDF"
                ? "Exportando PDF..."
                : "Exportar PDF"}

            </button>


            <button
              type="button"
              className="vg-boton-secundario"
              onClick={() => descargarDocumento("EXCEL")}
              disabled={
                !!descargando ||
                generando ||
                !informe.formatos_exportacion?.includes("EXCEL")
              }
            >

              {descargando === "EXCEL"
                ? "Exportando Excel..."
                : "Exportar Excel"}

            </button>

          </div>

        </section>

      )}

    </section>

  );
}