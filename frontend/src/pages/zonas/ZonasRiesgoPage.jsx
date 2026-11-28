
import { useEffect, useMemo, useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import { useAuth } from "../../hooks/useAuth";
import {
  listarZonas,
  modificarZona,
  eliminarZona,
  cambiarEstadoZona,
  consultarHistorialZona,
  crearZona,
  crearSolicitudZona,
  listarSolicitudesMias,
  listarTodasSolicitudes,
  evaluarSolicitud,
  eliminarSolicitud,
  registrarInspeccion,
  listarInspecciones,
  listarTodasInspecciones,
  emitirAlertaZona,
  resolverUbicacion,
} from "../../services/zonasService";
import BuscadorMapa from "../../components/zonas/BuscadorMapa";
import MapaInspeccion from "../../components/zonas/MapaInspeccion";
import MapaSelectorZona from "../../components/zonas/MapaSelectorZona";
import MapaSolicitud from "../../components/zonas/MapaSolicitud";
import SelectorVegetacion from "../../components/zonas/SelectorVegetacion";
import { climaActual } from "../../services/climaService";
import {
  CENTRO_BOLIVIA,
  DEPARTAMENTOS,
  ZOOM_BOLIVIA,
  centroide,
  departamentoDeZona,
  normalizar,
  puntosValidos,
  textoBusquedaZona,
} from "../../utils/geoBolivia";
import ZonasMapaGeneral, { COLORES_RIESGO } from "./ZonasMapaGeneral";
import "./ZonasRiesgoPage.css";

const FORMULARIO_VACIO = {
  nombre: "",
  ubicacion: "",
  descripcion: "",
  tipo_vegetacion: "",
};

// Puntos de la zona a partir de los campos del formulario (polígono en JSON o lat/lng sueltos).
function puntosDesdeCampos(form) {
  try {
    const validos = puntosValidos(JSON.parse(form.coordenadas || "[]"));
    if (validos.length) return validos;
  } catch {
    /* JSON incompleto mientras se escribe */
  }
  const lat = Number(form.latitud);
  const lng = Number(form.longitud);
  const hayTexto = String(form.latitud ?? "").trim() !== "" && String(form.longitud ?? "").trim() !== "";
  return hayTexto && Number.isFinite(lat) && Number.isFinite(lng) ? [{ lat, lng }] : [];
}

// Campos del formulario a partir de los puntos marcados en el mapa.
function camposDesdePuntos(puntos, siempreJson = false) {
  const c = centroide(puntos);
  return {
    latitud: c ? String(Number(c.lat.toFixed(6))) : "",
    longitud: c ? String(Number(c.lng.toFixed(6))) : "",
    coordenadas: puntos.length > 1 || (siempreJson && puntos.length) ? JSON.stringify(puntos) : "",
  };
}

const CLIMA_VACIO = { temperatura: "", humedad: "", velocidad_viento: "", tipo_vegetacion: "" };
const MATERIALES_COMBUSTIBLES = ["Pajonal", "Matorral", "Bosque Seco", "Basura", "Pastizal", "Hojarasca"];
const ACCESIBILIDADES = ["Fácil", "Media", "Difícil"];

function comprimirImagen(archivo, maxLado = 760) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * escala));
        canvas.height = Math.max(1, Math.round(img.height * escala));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => reject(new Error("Archivo de imagen no válido"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(archivo);
  });
}

function climaNumerico(form) {
  const salida = {};
  ["temperatura", "humedad", "velocidad_viento"].forEach((campo) => {
    const valor = String(form[campo] ?? "").trim();
    if (valor !== "" && Number.isFinite(Number(valor))) salida[campo] = Number(valor);
  });
  return salida;
}

export default function ZonasRiesgoPage() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "ADMINISTRADOR";

  const [zonas, setZonas] = useState([]);
  const [zonaEnMapa, setZonaEnMapa] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [vistaActiva, setVistaActiva] = useState("catalogo");
  const [filtroRiesgo, setFiltroRiesgo] = useState("TODOS");
  const [filtroDepto, setFiltroDepto] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [destinoMapa, setDestinoMapa] = useState(null);
  const [climaZonas, setClimaZonas] = useState({});

  const [zonaEditando, setZonaEditando] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);

  const [zonaEstado, setZonaEstado] = useState(null);
  const [motivo, setMotivo] = useState("");

  const [zonaHistorial, setZonaHistorial] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const esCiudadano = usuario?.rol === "CIUDADANO";
  const esBombero = usuario?.rol === "BOMBERO";
  const esOperador = usuario?.rol === "OPERADOR";
  const esGestorSolicitudes = esAdmin || esOperador;
  const puedeVerInspecciones = esAdmin || esOperador || esBombero;
  const [solicitudes, setSolicitudes] = useState([]);
  const [todasSolicitudes, setTodasSolicitudes] = useState([]);
  const [tabSolicitudes, setTabSolicitudes] = useState("PENDIENTE");
  const [inspecciones, setInspecciones] = useState([]);
  const [todasInspecciones, setTodasInspecciones] = useState([]);
  const [filtroZonaInsp, setFiltroZonaInsp] = useState("TODAS");
  const [filtroNivelInsp, setFiltroNivelInsp] = useState("TODOS");
  const [solicitudActiva, setSolicitudActiva] = useState(null);
  const [nivelFinalEval, setNivelFinalEval] = useState("MEDIO");
  const [notaEvaluacion, setNotaEvaluacion] = useState("");
  const [combustibleManual, setCombustibleManual] = useState("");
  const [zonaInspeccion, setZonaInspeccion] = useState("");
  const [formSolicitud, setFormSolicitud] = useState({ nombre: "", ubicacion: "", descripcion: "", latitud: "", longitud: "", nivel_riesgo_sugerido: "MEDIO" });
  const [formInspeccion, setFormInspeccion] = useState({
    nivel_riesgo_observado: "MEDIO",
    observaciones: "",
    recomendaciones: "",
    material_combustible: [],
    accesibilidad: "Media",
    fotos: [],
  });
  const [inspeccionActivaId, setInspeccionActivaId] = useState(null);
  const [climaCabecera, setClimaCabecera] = useState(null);
  const [formZonaNueva, setFormZonaNueva] = useState({ nombre: "", ubicacion: "", descripcion: "", nivel_riesgo: "MEDIO", latitud: "", longitud: "", coordenadas: "", ...CLIMA_VACIO });
  const [nombreManualNueva, setNombreManualNueva] = useState(false);
  const [nombreManualEdicion, setNombreManualEdicion] = useState(true);
  const puntosNuevaZona = useMemo(() => puntosDesdeCampos(formZonaNueva), [formZonaNueva.coordenadas, formZonaNueva.latitud, formZonaNueva.longitud]); // eslint-disable-line react-hooks/exhaustive-deps
  const puntosEdicion = useMemo(() => puntosDesdeCampos(formulario), [formulario.coordenadas]); // eslint-disable-line react-hooks/exhaustive-deps
  const puntosSolicitud = useMemo(() => puntosDesdeCampos(formSolicitud), [formSolicitud.latitud, formSolicitud.longitud]); // eslint-disable-line react-hooks/exhaustive-deps
  const tiposVegetacion = useMemo(
    () => [...new Set(zonas.map((z) => z.tipo_vegetacion).filter(Boolean))],
    [zonas]
  );
  const [zonaAlerta, setZonaAlerta] = useState(null);
  const [mensajeAlerta, setMensajeAlerta] = useState("");

  async function cargarZonas() {
    try {
      setCargando(true);
      setError("");
      const respuesta = await listarZonas();
      setZonas(respuesta.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarZonas();
  }, []);

  const pendientes = useMemo(() => todasSolicitudes.filter((s) => s.estado === "PENDIENTE"), [todasSolicitudes]);
  const aprobadas = useMemo(() => todasSolicitudes.filter((s) => s.estado === "APROBADA"), [todasSolicitudes]);
  const denegadas = useMemo(() => todasSolicitudes.filter((s) => s.estado === "RECHAZADA"), [todasSolicitudes]);

  async function cargarSolicitudesGestor() {
    const r = await listarTodasSolicitudes();
    setTodasSolicitudes(r.data || []);
  }

  async function cargarHistorialInspecciones() {
    const r = await listarTodasInspecciones();
    setTodasInspecciones(r.data || []);
  }

  useEffect(() => {
    if (esCiudadano) listarSolicitudesMias().then((r) => setSolicitudes(r.data || [])).catch((e) => setError(e.message));
    if (esGestorSolicitudes) cargarSolicitudesGestor().catch((e) => setError(e.message));
    if (puedeVerInspecciones) cargarHistorialInspecciones().catch((e) => setError(e.message));
  }, [esCiudadano, esGestorSolicitudes, puedeVerInspecciones]);

  function limpiarAvisos() {
    setError("");
    setMensaje("");
  }

  function capturarUbicacion(setFormulario) {
    limpiarAvisos();
    if (!navigator.geolocation) {
      setError("Este navegador no permite obtener la ubicación GPS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setFormulario((actual) => ({ ...actual, latitud: String(coords.latitude), longitud: String(coords.longitude) }));
        setMensaje("Ubicación GPS capturada desde este dispositivo.");
      },
      () => setError("No se pudo obtener la ubicación. Permite el acceso en el navegador o escribe las coordenadas manualmente."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function resolverUbicacionFormulario(setFormulario, formulario) {
    limpiarAvisos();
    if (!formulario.ubicacion.trim()) {
      setError("Primero pega un enlace de Google Maps o unas coordenadas en el campo Ubicación.");
      return;
    }
    try {
      setProcesando(true);
      const respuesta = await resolverUbicacion(formulario.ubicacion);
      setFormulario((actual) => ({ ...actual, latitud: String(respuesta.data.lat), longitud: String(respuesta.data.lng) }));
      setMensaje("Coordenadas obtenidas desde la ubicación indicada.");
    } catch (err) {
      setError(err.message || "No pude obtener GPS de ese enlace. Prueba con un enlace compartido de Google Maps o usa tu ubicación actual.");
    } finally {
      setProcesando(false);
    }
  }

  function abrirEdicion(zona) {
    limpiarAvisos();
    setVistaActiva("modificar");
    setZonaEditando(zona);
    setNombreManualEdicion(Boolean((zona.nombre || "").trim()));
    setFormulario({
      nombre: zona.nombre || "",
      ubicacion: zona.ubicacion || "",
      descripcion: zona.descripcion || "",
      tipo_vegetacion: zona.tipo_vegetacion || "",
      nivel_riesgo: zona.nivel_riesgo || "MEDIO",
      coordenadas: JSON.stringify(zona.coordenadas || [], null, 2),
      temperatura: zona.temperatura != null ? String(zona.temperatura) : "",
      humedad: zona.humedad != null ? String(zona.humedad) : "",
      velocidad_viento: zona.velocidad_viento != null ? String(zona.velocidad_viento) : "",
    });
  }

  async function guardarEdicion(evento) {
    evento.preventDefault();
    if (!zonaEditando) return;

    try {
      setProcesando(true);
      limpiarAvisos();

      let coordenadas;
      try { coordenadas = JSON.parse(formulario.coordenadas || "[]"); }
      catch { setError("Las coordenadas deben ser una lista JSON válida."); setProcesando(false); return; }
      if (!Array.isArray(coordenadas) || !coordenadas.length || coordenadas.some((p) => !p || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng))) || (coordenadas.length > 1 && coordenadas.length < 3)) {
        setError("Indica un punto GPS o un polígono de al menos tres puntos válidos."); setProcesando(false); return;
      }

      // eslint-disable-next-line no-unused-vars
      const { temperatura, humedad, velocidad_viento, ...resto } = formulario;
      const nombreFinal = (formulario.nombre || "").trim() || formulario.ubicacion.trim();
      if (zonas.some((z) => z.id_zona !== zonaEditando.id_zona && normalizar(z.nombre) === normalizar(nombreFinal))) {
        setError(`Ya existe otra zona registrada con el nombre «${nombreFinal}».`);
        setProcesando(false);
        return;
      }
      await modificarZona(zonaEditando.id_zona, {
        ...resto,
        nombre: nombreFinal,
        ...climaNumerico(formulario),
        coordenadas: coordenadas.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })),
      });

      setZonaEditando(null);
      setVistaActiva("catalogo");
      setMensaje("Zona modificada correctamente.");
      await cargarZonas();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  async function borrarZona(zona) {
    if (!esAdmin || !window.confirm(`¿Eliminar la zona “${zona.nombre}”? Se eliminarán su historial, inspecciones, alertas y focos vinculados. Los incidentes y solicitudes aprobadas se conservarán sin asociación a esta zona. Esta acción no se puede deshacer.`)) return;
    try {
      setProcesando(true);
      limpiarAvisos();
      await eliminarZona(zona.id_zona);
      setMensaje(`Zona “${zona.nombre}” eliminada correctamente.`);
      await cargarZonas();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  function abrirCambioEstado(zona) {
    limpiarAvisos();
    setVistaActiva("estado");
    setZonaEstado(zona);
    setMotivo("");
  }

  async function guardarCambioEstado(evento) {
    evento.preventDefault();
    if (!zonaEstado || !motivo.trim()) return;

    const nuevoEstado =
      zonaEstado.estado === "Activa" ? "Inactiva" : "Activa";

    try {
      setProcesando(true);
      limpiarAvisos();

      await cambiarEstadoZona(
        zonaEstado.id_zona,
        nuevoEstado,
        motivo.trim()
      );

      setZonaEstado(null);
      setVistaActiva("catalogo");
      setMensaje(`Zona cambiada a ${nuevoEstado}.`);
      await cargarZonas();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  async function abrirHistorial(zona) {
    limpiarAvisos();
    setVistaActiva("historial");
    setZonaHistorial(zona);
    setHistorial([]);
    setCargandoHistorial(true);

    try {
      const respuesta = await consultarHistorialZona(zona.id_zona);
      setHistorial(respuesta.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoHistorial(false);
    }
  }

  async function enviarSolicitud(evento) {
    evento.preventDefault();
    if (!formSolicitud.latitud.trim() || !formSolicitud.longitud.trim()) { setError("La solicitud necesita latitud y longitud GPS."); return; }
    try {
      setProcesando(true); limpiarAvisos();
      const nombreFinal = formSolicitud.nombre.trim() || formSolicitud.ubicacion.trim().slice(0, 100);
      await crearSolicitudZona({ ...formSolicitud, nombre: nombreFinal });
      setFormSolicitud({ nombre: "", ubicacion: "", descripcion: "", latitud: "", longitud: "", nivel_riesgo_sugerido: "MEDIO" });
      const respuesta = await listarSolicitudesMias(); setSolicitudes(respuesta.data || []);
      setVistaActiva("catalogo"); setMensaje("Solicitud enviada para evaluación.");
    } catch (err) { setError(err.message); } finally { setProcesando(false); }
  }

  function abrirEvaluacion(sol) {
    limpiarAvisos();
    setSolicitudActiva(sol);
    setNivelFinalEval(sol.nivel_riesgo_sugerido || "MEDIO");
    setNotaEvaluacion("");
  }

  async function resolverSolicitud(evento, estado) {
    evento.preventDefault();
    if (!solicitudActiva) return;
    if (estado === "RECHAZADA" && !notaEvaluacion.trim()) {
      setError("Escribe el motivo de la denegación en Observaciones de evaluación.");
      return;
    }
    try {
      setProcesando(true); limpiarAvisos();
      await evaluarSolicitud(solicitudActiva.id_solicitud, estado, notaEvaluacion, nivelFinalEval);
      await cargarSolicitudesGestor();
      if (estado === "APROBADA") await cargarZonas();
      setSolicitudActiva(null); setNotaEvaluacion("");
      setMensaje(
        estado === "APROBADA"
          ? "Solicitud aprobada. La zona ya figura en el catálogo y en el Mapa general."
          : "Solicitud denegada y registrada en el historial de denegadas."
      );
    } catch (err) { setError(err.message); } finally { setProcesando(false); }
  }

  async function borrarSolicitud(sol) {
    if (!window.confirm(`¿Eliminar la solicitud «${sol.nombre}»?`)) return;
    try {
      setProcesando(true); limpiarAvisos();
      await eliminarSolicitud(sol.id_solicitud);
      await cargarSolicitudesGestor();
      if (solicitudActiva?.id_solicitud === sol.id_solicitud) setSolicitudActiva(null);
      setMensaje("Solicitud eliminada.");
    } catch (err) { setError(err.message); } finally { setProcesando(false); }
  }

  async function guardarInspeccion(evento) {
    evento.preventDefault();
    try {
      setProcesando(true); limpiarAvisos();
      await registrarInspeccion({ ...formInspeccion, id_zona: Number(zonaInspeccion) });
      setFormInspeccion({
        nivel_riesgo_observado: "MEDIO",
        observaciones: "",
        recomendaciones: "",
        material_combustible: [],
        accesibilidad: "Media",
        fotos: [],
      });
      setCombustibleManual("");
      const respuesta = await listarInspecciones(zonaInspeccion);
      setInspecciones(respuesta.data || []);
      setInspeccionActivaId(respuesta.data?.[0]?.id_inspeccion ?? null);
      await cargarHistorialInspecciones();
      setMensaje("Inspección registrada.");
    } catch (err) { setError(err.message); } finally { setProcesando(false); }
  }

  async function cargarInspecciones(idZona) {
    setZonaInspeccion(idZona);
    setInspeccionActivaId(null);
    if (!idZona) { setInspecciones([]); return; }
    try {
      const respuesta = await listarInspecciones(idZona);
      setInspecciones(respuesta.data || []);
      setInspeccionActivaId(respuesta.data?.[0]?.id_inspeccion ?? null);
    } catch (err) { setError(err.message); }
  }

  function alternarMaterial(material) {
    setFormInspeccion((a) => ({
      ...a,
      material_combustible: a.material_combustible.includes(material)
        ? a.material_combustible.filter((m) => m !== material)
        : [...a.material_combustible, material],
    }));
  }

  function agregarMaterialManual() {
    const limpio = combustibleManual.trim();
    if (!limpio) return;
    setFormInspeccion((a) => ({
      ...a,
      material_combustible: a.material_combustible.some((m) => m.toLowerCase() === limpio.toLowerCase())
        ? a.material_combustible
        : [...a.material_combustible, limpio],
    }));
    setCombustibleManual("");
  }

  async function adjuntarFotosInspeccion(evento) {
    const archivos = Array.from(evento.target.files || []).slice(0, 4);
    evento.target.value = "";
    if (!archivos.length) return;
    try {
      const comprimidas = await Promise.all(archivos.map((f) => comprimirImagen(f)));
      setFormInspeccion((a) => ({ ...a, fotos: [...a.fotos, ...comprimidas].slice(0, 4) }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardarZonaNueva(evento) {
    evento.preventDefault();
    const lat = formZonaNueva.latitud.trim(); const lng = formZonaNueva.longitud.trim();
    if ((lat === "") !== (lng === "")) { setError("Completa latitud y longitud juntas."); return; }
    if (lat === "" || lng === "") { setError("Registra o captura las coordenadas GPS de la zona."); return; }
    let coordenadas = [{ lat: Number(lat), lng: Number(lng) }];
    if (formZonaNueva.coordenadas.trim()) {
      try { coordenadas = JSON.parse(formZonaNueva.coordenadas); }
      catch { setError("El polígono debe ser una lista JSON de puntos con lat y lng."); return; }
      if (!Array.isArray(coordenadas) || coordenadas.length < 3 || coordenadas.some((p) => !p || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng)))) {
        setError("El polígono necesita al menos tres puntos GPS válidos."); return;
      }
      coordenadas = coordenadas.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
    }
    try {
      setProcesando(true); limpiarAvisos();
      const nombreFinal = formZonaNueva.nombre.trim() || formZonaNueva.ubicacion.trim();
      const nombreNorm = normalizar(nombreFinal);
      if (zonas.some((z) => normalizar(z.nombre) === nombreNorm)) {
        setError(`Ya existe una zona registrada con el nombre «${nombreFinal}».`);
        return;
      }
      await crearZona({
        nombre: nombreFinal,
        ubicacion: formZonaNueva.ubicacion.trim(),
        descripcion: formZonaNueva.descripcion,
        nivel_riesgo: formZonaNueva.nivel_riesgo,
        coordenadas,
        ...(formZonaNueva.tipo_vegetacion.trim() ? { tipo_vegetacion: formZonaNueva.tipo_vegetacion.trim() } : {}),
        ...climaNumerico(formZonaNueva),
      });
      setFormZonaNueva({ nombre: "", ubicacion: "", descripcion: "", nivel_riesgo: "MEDIO", latitud: "", longitud: "", coordenadas: "", ...CLIMA_VACIO });
      setNombreManualNueva(false);
      await cargarZonas(); setMensaje("Zona registrada.");
    } catch (err) { setError(err.message); } finally { setProcesando(false); }
  }

  async function guardarAlerta(evento) {
    evento.preventDefault();
    if (!zonaAlerta) return;
    try {
      setProcesando(true); limpiarAvisos();
      await emitirAlertaZona(zonaAlerta.id_zona, { mensaje: mensajeAlerta.trim() || `Alerta preventiva para ${zonaAlerta.nombre}`, nivel_alerta: zonaAlerta.nivel_riesgo === "EXTREMO" ? "Roja" : "Naranja" });
      setZonaAlerta(null); setMensajeAlerta(""); await cargarZonas(); setVistaActiva("catalogo"); setMensaje("Alerta preventiva emitida.");
    } catch (err) { setError(err.message); } finally { setProcesando(false); }
  }

  function irAVista(vista) {
    limpiarAvisos();
    setVistaActiva(vista);
  }

  const busquedaNorm = normalizar(busqueda);
  const baseFiltrada = zonas.filter(
    (z) =>
      (filtroDepto === "TODOS" || departamentoDeZona(z) === filtroDepto) &&
      (!busquedaNorm || textoBusquedaZona(z).includes(busquedaNorm))
  );
  const zonasFiltradas =
    filtroRiesgo === "TODOS"
      ? baseFiltrada
      : baseFiltrada.filter((z) => z.nivel_riesgo === filtroRiesgo);
  const hayFiltros = filtroRiesgo !== "TODOS" || filtroDepto !== "TODOS" || busquedaNorm !== "";

  const conteoRiesgo = {
    TODOS: baseFiltrada.length,
    BAJO: baseFiltrada.filter((z) => z.nivel_riesgo === "BAJO").length,
    MEDIO: baseFiltrada.filter((z) => z.nivel_riesgo === "MEDIO").length,
    ALTO: baseFiltrada.filter((z) => z.nivel_riesgo === "ALTO").length,
    EXTREMO: baseFiltrada.filter((z) => z.nivel_riesgo === "EXTREMO").length,
  };

  // Clima actual (Open-Meteo) de cada zona; si no responde se muestran los valores registrados.
  useEffect(() => {
    const conPunto = zonas.map((z) => ({ id: z.id_zona, centro: centroide(z.coordenadas) })).filter((x) => x.centro);
    if (!conPunto.length) return undefined;
    let cancelado = false;
    climaActual(conPunto.map((x) => x.centro))
      .then((resultado) => {
        if (cancelado) return;
        const mapa = {};
        conPunto.forEach((x, i) => { mapa[x.id] = resultado[i]; });
        setClimaZonas(mapa);
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [zonas]);

  useEffect(() => {
    if (vistaActiva !== "clima") return undefined;
    const dep = DEPARTAMENTOS.find((d) => d.nombre === (filtroDepto === "TODOS" ? "La Paz" : filtroDepto));
    if (!dep) return undefined;
    let cancelado = false;
    climaActual([{ lat: dep.centro[0], lng: dep.centro[1] }])
      .then(([dato]) => {
        if (!cancelado && dato) setClimaCabecera({ nombre: `${dep.nombre}, Bolivia`, ...dato });
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [vistaActiva, filtroDepto]);

  async function autocompletarClima(form, setForm) {
    limpiarAvisos();
    const centro = centroide(puntosDesdeCampos(form));
    if (!centro) {
      setError("Marca primero la zona en el mapa para consultar su clima.");
      return;
    }
    try {
      setProcesando(true);
      const [clima] = await climaActual([centro]);
      setForm((a) => ({
        ...a,
        temperatura: String(Number(clima.temp).toFixed(1)),
        humedad: String(Math.round(clima.hum)),
        velocidad_viento: String(Number(clima.viento).toFixed(1)),
      }));
      setMensaje("Clima actual cargado desde Open-Meteo.");
    } catch (err) {
      setError(err.message || "No se pudo consultar el clima.");
    } finally {
      setProcesando(false);
    }
  }

  function detalleClima(zona) {
    const vivo = climaZonas[zona.id_zona];
    if (vivo) {
      return `🌡️ ${Number(vivo.temp).toFixed(1)} °C · 💧 ${Math.round(vivo.hum)} % · 💨 ${Math.round(vivo.viento)} km/h · 🌧️ ${Number(vivo.lluvia24).toFixed(1)} mm (24 h)`;
    }
    return `🌡️ ${Number(zona.temperatura ?? 0).toFixed(1)} °C · 💧 ${Math.round(zona.humedad ?? 0)} % · 💨 ${Math.round(zona.velocidad_viento ?? 0)} km/h (registrado)`;
  }

  function volarADepartamento(nombre) {
    setFiltroDepto(nombre ?? "TODOS");
    const dep = DEPARTAMENTOS.find((d) => d.nombre === nombre);
    setDestinoMapa(
      dep
        ? { tipo: "departamento", lat: dep.centro[0], lng: dep.centro[1], zoom: dep.zoom, clave: Date.now() }
        : { tipo: "departamento", lat: CENTRO_BOLIVIA[0], lng: CENTRO_BOLIVIA[1], zoom: ZOOM_BOLIVIA, clave: Date.now() }
    );
  }

  function seleccionarEnBuscador(seleccion) {
    if (seleccion.tipo === "departamento") {
      volarADepartamento(seleccion.departamento);
      setBusqueda("");
    } else if (seleccion.tipo === "zona") {
      setBusqueda(seleccion.zona.nombre);
      setDestinoMapa({ tipo: "zona", lat: seleccion.lat, lng: seleccion.lng, zoom: 11, idZona: seleccion.zona.id_zona, clave: Date.now() });
    } else {
      setBusqueda("");
      setDestinoMapa({ tipo: "lugar", lat: seleccion.lat, lng: seleccion.lng, bbox: seleccion.bbox, nombre: seleccion.nombre, clave: Date.now() });
    }
  }

  function renderFiltros() {
    return (
      <>
        <div className="zr-filtros-barra">
          <BuscadorMapa valor={busqueda} onValorChange={setBusqueda} onSeleccionar={seleccionarEnBuscador} zonas={zonas} />
          <label className="zr-filtro-depto">
            <span>Departamento</span>
            <select value={filtroDepto} onChange={(e) => volarADepartamento(e.target.value === "TODOS" ? null : e.target.value)}>
              <option value="TODOS">Todos los departamentos</option>
              {DEPARTAMENTOS.map((d) => <option key={d.nombre} value={d.nombre}>{d.nombre}</option>)}
            </select>
          </label>
          {hayFiltros && (
            <button type="button" className="zr-boton zr-secundario" onClick={() => { setFiltroRiesgo("TODOS"); setFiltroDepto("TODOS"); setBusqueda(""); }}>
              Limpiar filtros
            </button>
          )}
        </div>
        {renderFiltroRiesgo()}
      </>
    );
  }

  function renderFiltroRiesgo() {
    const opciones = [
      { id: "TODOS", etiqueta: "Todas", color: null },
      { id: "BAJO", etiqueta: "Bajo", color: COLORES_RIESGO.BAJO },
      { id: "MEDIO", etiqueta: "Medio", color: COLORES_RIESGO.MEDIO },
      { id: "ALTO", etiqueta: "Alto", color: COLORES_RIESGO.ALTO },
      { id: "EXTREMO", etiqueta: "Extremo", color: COLORES_RIESGO.EXTREMO },
    ];
    return (
      <div className="zr-filtros" role="group" aria-label="Filtrar por nivel de riesgo">
        <span className="zr-filtros-titulo">Filtrar por riesgo:</span>
        {opciones.map((op) => {
          const activo = filtroRiesgo === op.id;
          return (
            <button
              key={op.id}
              type="button"
              aria-pressed={activo}
              className={`zr-boton ${activo ? "zr-primario" : "zr-secundario"} zr-filtro-boton`}
              onClick={() => setFiltroRiesgo(op.id)}
            >
              {op.color && <span className="zr-leyenda-color" style={{ background: op.color }} />}
              {op.etiqueta} ({conteoRiesgo[op.id]})
            </button>
          );
        })}
      </div>
    );
  }

  function renderBotonesAcciones(incluirMapa) {
    const clase = (vista) => `zr-boton ${vistaActiva === vista ? "zr-primario" : "zr-secundario"}`;
    return <>
      <button type="button" className={clase("catalogo")} onClick={() => irAVista("catalogo")}>Catálogo de zonas</button>
      {incluirMapa && <>
        <button type="button" className={clase("mapa")} onClick={() => irAVista("mapa")}>Mapa general</button>
        <button type="button" className={clase("clima")} onClick={() => irAVista("clima")}>Clima</button>
      </>}
      {esAdmin && (
        <button type="button" className={clase("registrar")} onClick={() => irAVista("registrar")}>Registrar zona</button>
      )}
      {esGestorSolicitudes && (
        <button type="button" className={clase("solicitudes")} onClick={() => { setSolicitudActiva(null); irAVista("solicitudes"); }}>Solicitudes ({pendientes.length})</button>
      )}
      {esAdmin && (
        <button type="button" className={clase("seleccionar-modificar")} onClick={() => irAVista("seleccionar-modificar")}>Modificar zona</button>
      )}
      {esCiudadano && <button type="button" className={clase("solicitud")} onClick={() => irAVista("solicitud")}>Solicitar zona</button>}
      {esBombero && <button type="button" className={clase("inspeccion")} onClick={() => irAVista("inspeccion")}>Registrar inspección</button>}
      {puedeVerInspecciones && <button type="button" className={clase("historial-inspecciones")} onClick={() => irAVista("historial-inspecciones")}>Historial de inspecciones ({todasInspecciones.length})</button>}
    </>;
  }

  return (
    <AppLayout ancha suelta>
      <div className="zr-pagina">
        <header className="zr-cabecera">
          <div>
            <span className="zr-etiqueta">
              Gestión de Zonas de Riesgo
            </span>
            <h1>Zonas de Riesgo</h1>
            <p>
              Consulta, modificación y seguimiento de zonas
              mediante un historial de estados.
            </p>
          </div>
          <button
            className="zr-boton zr-secundario"
            onClick={cargarZonas}
            disabled={cargando}
          >
            Actualizar listado
          </button>
        </header>

        <nav className="zr-navegacion" aria-label="Acciones de zonas de riesgo">
          {renderBotonesAcciones(true)}
        </nav>

        {error && <p role="alert" className="zr-error">{error}</p>}
        {mensaje && <p role="status" className="zr-exito">{mensaje}</p>}

        {vistaActiva === "mapa" && <section className="zr-panel zr-zonas-panel">
          <h2>Mapa general de zonas de riesgo ({zonasFiltradas.length}{zonasFiltradas.length !== zonas.length ? ` de ${zonas.length}` : ""})</h2>
          {renderFiltros()}
          {cargando ? <p>Cargando zonas...</p> : <ZonasMapaGeneral zonas={zonasFiltradas} climaZonas={climaZonas} destino={destinoMapa} />}
          <div className="zr-acciones zr-acciones-mapa">{renderBotonesAcciones(false)}</div>
        </section>}

        {vistaActiva === "clima" && <section className="zr-panel zr-zonas-panel">
          <div className="zr-clima-header">
            <div>
              <h2>Monitoreo Climático</h2>
              <p className="zr-ayuda-gps">Consulta y seguimiento de condiciones meteorológicas en tiempo real.</p>
            </div>
            {climaCabecera && (
              <div className="zr-clima-vivo">
                <div className="zr-clima-vivo-top">
                  <strong>{climaCabecera.nombre}</strong>
                  <span className="zr-vivo-dot">● En vivo</span>
                </div>
                <div className="zr-clima-vivo-datos">
                  <span>🌡️ {Number(climaCabecera.temp).toFixed(0)} °C</span>
                  <span>💧 {Math.round(climaCabecera.hum)}%</span>
                  <span>💨 {Math.round(climaCabecera.viento)} km/h</span>
                </div>
              </div>
            )}
          </div>
          {renderFiltros()}
          {cargando ? <p>Cargando zonas...</p> : <ZonasMapaGeneral zonas={zonasFiltradas} climaZonas={climaZonas} destino={destinoMapa} analisisInicial="temperatura" modoClima />}
          {!cargando && zonasFiltradas.length > 0 && (
            <>
              <h3 className="zr-clima-subtitulo">Zonas Monitoreadas</h3>
              <div className="zr-tabla-contenedor">
                <table className="zr-tabla">
                  <thead>
                    <tr><th>Zona</th><th>Departamento</th><th>Riesgo</th><th>Temp. (°C)</th><th>Humedad (%)</th><th>Viento (km/h)</th><th>Lluvia 24 h (mm)</th></tr>
                  </thead>
                  <tbody>
                    {zonasFiltradas.map((z) => {
                      const v = climaZonas[z.id_zona];
                      return (
                        <tr key={z.id_zona}>
                          <td>{z.nombre}</td>
                          <td>{departamentoDeZona(z) || "—"}</td>
                          <td><span className={`zr-riesgo-pill zr-riesgo-${(z.nivel_riesgo || "medio").toLowerCase()}`}>{z.nivel_riesgo}</span></td>
                          <td>{Number(v ? v.temp : z.temperatura).toFixed(1)}</td>
                          <td>{Math.round(v ? v.hum : z.humedad)}</td>
                          <td>{Math.round(v ? v.viento : z.velocidad_viento)}</td>
                          <td>{v ? Number(v.lluvia24).toFixed(1) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="zr-acciones zr-acciones-mapa">{renderBotonesAcciones(false)}</div>
        </section>}

        {esAdmin && vistaActiva === "seleccionar-modificar" && <section className="zr-panel">
          <h2>Selecciona una zona para modificar</h2>
          {renderFiltros()}
          {!zonas.length ? <p>No hay zonas registradas.</p> : !zonasFiltradas.length ? <p>No hay zonas que coincidan con los filtros aplicados.</p> : <div className="zr-grid">{zonasFiltradas.map((zona) => <article className="zr-tarjeta" key={zona.id_zona}><h3>{zona.nombre}</h3><p><strong>Ubicación:</strong> {zona.ubicacion}</p>{zona.latitud != null && <p><strong>Latitud:</strong> {Number(zona.latitud).toFixed(5)} · <strong>Longitud:</strong> {Number(zona.longitud).toFixed(5)}</p>}<p><strong>Riesgo:</strong> {zona.nivel_riesgo}</p><button className="zr-boton zr-primario" onClick={() => abrirEdicion(zona)}>Modificar</button></article>)}</div>}
        </section>}

        {esCiudadano && vistaActiva === "solicitud" && <section className="zr-panel">
          <h2>Solicitar registro de zona</h2>
          <form className="zr-form-grid" onSubmit={enviarSolicitud}>
            <div className="zr-form-col-izq">
              <label>Nombre <small className="zr-opcional">(opcional, se autocompleta desde el mapa)</small><input value={formSolicitud.nombre} onChange={(e) => setFormSolicitud({ ...formSolicitud, nombre: e.target.value })} placeholder="Se completa al puntear en el mapa" /></label>
              <label>Ubicación (zona, calle o enlace de Google Maps)<input required value={formSolicitud.ubicacion} onChange={(e) => setFormSolicitud({ ...formSolicitud, ubicacion: e.target.value })} placeholder="Dirección, referencia o enlace compartido de Google Maps" /></label>
              {formSolicitud.latitud !== "" && formSolicitud.longitud !== "" && (
                <p className="zr-gps-listo">Latitud: {formSolicitud.latitud} · Longitud: {formSolicitud.longitud}</p>
              )}
              <label>Descripción<textarea required rows={3} value={formSolicitud.descripcion} onChange={(e) => setFormSolicitud({ ...formSolicitud, descripcion: e.target.value })} /></label>
              <label>Nivel de riesgo sugerido<select value={formSolicitud.nivel_riesgo_sugerido} onChange={(e) => setFormSolicitud({ ...formSolicitud, nivel_riesgo_sugerido: e.target.value })}>{["BAJO", "MEDIO", "ALTO", "EXTREMO"].map((n) => <option key={n}>{n}</option>)}</select></label>
              <div className="zr-acciones">
                <button type="button" className="zr-boton zr-secundario" onClick={() => capturarUbicacion(setFormSolicitud)}>📍 Usar mi ubicación actual</button>
                <button type="button" className="zr-boton zr-secundario" disabled={procesando} onClick={() => resolverUbicacionFormulario(setFormSolicitud, formSolicitud)}>GPS desde Google Maps</button>
              </div>
              <details className="zr-coordenadas-manuales"><summary>Ingresar coordenadas manualmente</summary><div className="zr-campos-dobles"><label>Latitud<input type="number" min="-90" max="90" step="any" value={formSolicitud.latitud} onChange={(e) => setFormSolicitud({ ...formSolicitud, latitud: e.target.value })} /></label><label>Longitud<input type="number" min="-180" max="180" step="any" value={formSolicitud.longitud} onChange={(e) => setFormSolicitud({ ...formSolicitud, longitud: e.target.value })} /></label></div></details>
              <div className="zr-acciones">
                <button className="zr-boton zr-primario" disabled={procesando}>Enviar solicitud</button>
              </div>
            </div>
            <div className="zr-form-col-der">
              <span className="zr-campo-titulo">Marca en el mapa la zona exacta</span>
              <MapaSelectorZona
                modo="punto"
                altura={520}
                puntos={puntosSolicitud}
                color={COLORES_RIESGO[formSolicitud.nivel_riesgo_sugerido]}
                onChange={(pts) => setFormSolicitud((a) => ({ ...a, latitud: pts[0] ? String(pts[0].lat) : "", longitud: pts[0] ? String(pts[0].lng) : "" }))}
                onDireccionDetectada={(info) =>
                  setFormSolicitud((a) => ({
                    ...a,
                    ubicacion: info.ubicacion,
                    nombre: a.nombre.trim() ? a.nombre : info.nombre,
                  }))
                }
              />
            </div>
          </form>
          <h3 className="zr-clima-subtitulo">Mis solicitudes</h3>
          {solicitudes.length ? <ul className="zr-lista">{solicitudes.map((s) => <li key={s.id_solicitud}><strong>{s.nombre}</strong> · {s.estado}{s.observacion_admin ? ` · ${s.observacion_admin}` : ""}</li>)}</ul> : <p>Aún no tienes solicitudes.</p>}
        </section>}

        {esAdmin && vistaActiva === "registrar" && <section className="zr-panel">
          <h2>Registrar zona de riesgo</h2>
          <form className="zr-form-grid" onSubmit={guardarZonaNueva}>
            <div className="zr-form-col-izq">
              <label>Nombre <small className="zr-opcional">(opcional, se autocompleta desde el mapa)</small><input value={formZonaNueva.nombre} onChange={(e) => { setNombreManualNueva(e.target.value.trim() !== ""); setFormZonaNueva({ ...formZonaNueva, nombre: e.target.value }); }} placeholder="Se completa automáticamente al ubicar en el mapa" /></label>
              <label>Ubicación (zona, calle y departamento)<input required value={formZonaNueva.ubicacion} onChange={(e) => setFormZonaNueva({ ...formZonaNueva, ubicacion: e.target.value })} placeholder="Calle, zona o barrio, departamento (se llena desde el mapa)" /></label>
              {formZonaNueva.latitud !== "" && formZonaNueva.longitud !== "" && (
                <p className="zr-gps-listo">Latitud: {formZonaNueva.latitud} · Longitud: {formZonaNueva.longitud}</p>
              )}
              <label>Descripción<textarea rows={2} value={formZonaNueva.descripcion} onChange={(e) => setFormZonaNueva({ ...formZonaNueva, descripcion: e.target.value })} /></label>
              <div className="zr-campos-dobles">
                <label>Nivel de riesgo<select value={formZonaNueva.nivel_riesgo} onChange={(e) => setFormZonaNueva({ ...formZonaNueva, nivel_riesgo: e.target.value })}>{["BAJO", "MEDIO", "ALTO", "EXTREMO"].map((n) => <option key={n}>{n}</option>)}</select></label>
                <div className="zr-campo-etiqueta">
                  <span>Tipo de vegetación</span>
                  <SelectorVegetacion
                    value={formZonaNueva.tipo_vegetacion}
                    opcionesExistentes={tiposVegetacion}
                    onChange={(valor) => setFormZonaNueva((a) => ({ ...a, tipo_vegetacion: valor }))}
                  />
                </div>
              </div>
              <fieldset className="zr-clima-campos">
                <legend>Condiciones climáticas de la zona</legend>
                <div className="zr-campos-triples">
                  <label>Temperatura (°C)<input type="number" step="any" min="-30" max="60" value={formZonaNueva.temperatura} onChange={(e) => setFormZonaNueva({ ...formZonaNueva, temperatura: e.target.value })} /></label>
                  <label>Humedad (%)<input type="number" step="any" min="0" max="100" value={formZonaNueva.humedad} onChange={(e) => setFormZonaNueva({ ...formZonaNueva, humedad: e.target.value })} /></label>
                  <label>Viento (km/h)<input type="number" step="any" min="0" max="300" value={formZonaNueva.velocidad_viento} onChange={(e) => setFormZonaNueva({ ...formZonaNueva, velocidad_viento: e.target.value })} /></label>
                </div>
                <button type="button" className="zr-boton zr-secundario" disabled={procesando} onClick={() => autocompletarClima(formZonaNueva, setFormZonaNueva)}>☁️ Autocompletar con el clima actual</button>
              </fieldset>
              <details className="zr-coordenadas-manuales"><summary>Ingresar coordenadas manualmente</summary>
                <div className="zr-campos-dobles">
                  <label>Latitud<input type="number" min="-90" max="90" step="any" value={formZonaNueva.latitud} onChange={(e) => setFormZonaNueva({ ...formZonaNueva, latitud: e.target.value })} /></label>
                  <label>Longitud<input type="number" min="-180" max="180" step="any" value={formZonaNueva.longitud} onChange={(e) => setFormZonaNueva({ ...formZonaNueva, longitud: e.target.value })} /></label>
                </div>
                <label>Polígono cartográfico (JSON, opcional)<textarea rows={3} value={formZonaNueva.coordenadas} onChange={(e) => setFormZonaNueva({ ...formZonaNueva, coordenadas: e.target.value })} placeholder={'[{"lat": -17.30, "lng": -66.19}, {"lat": -17.31, "lng": -66.18}, {"lat": -17.32, "lng": -66.20}]'} /></label>
              </details>
              <p className="zr-ayuda-gps">No se permiten zonas duplicadas (mismo nombre o misma ubicación).</p>
              <div className="zr-acciones">
                <button className="zr-boton zr-primario" disabled={procesando}>Registrar zona</button>
              </div>
            </div>
            <div className="zr-form-col-der">
              <span className="zr-campo-titulo">Ubicación y polígono de la zona</span>
              <MapaSelectorZona
                modo="poligono"
                altura={540}
                puntos={puntosNuevaZona}
                color={COLORES_RIESGO[formZonaNueva.nivel_riesgo]}
                onChange={(pts) => setFormZonaNueva((a) => ({ ...a, ...camposDesdePuntos(pts) }))}
                onDireccionDetectada={(info) =>
                  setFormZonaNueva((a) => ({
                    ...a,
                    ubicacion: info.ubicacion,
                    nombre: nombreManualNueva ? a.nombre : info.nombre,
                  }))
                }
              />
            </div>
          </form>
        </section>}

        {esGestorSolicitudes && vistaActiva === "solicitudes" && <section className="zr-panel">
          {solicitudActiva ? (
            <div className="zr-eval-vista">
              <button type="button" className="zr-volver" onClick={() => { setSolicitudActiva(null); setNotaEvaluacion(""); }}>
                ← Volver a solicitudes
              </button>
              <div className="zr-eval-titulo">
                <h2>Evaluar solicitud: {solicitudActiva.nombre}</h2>
                <span className="zr-pill-pendiente">Pendiente</span>
              </div>
              <div className="zr-form-grid">
                <form className="zr-form-col-izq" onSubmit={(e) => e.preventDefault()}>
                  <div className="zr-eval-resumen">
                    <p><strong>Ubicación</strong><br />{solicitudActiva.ubicacion}</p>
                    {solicitudActiva.latitud != null && (
                      <p><strong>Latitud:</strong> {Number(solicitudActiva.latitud).toFixed(5)} · <strong>Longitud:</strong> {Number(solicitudActiva.longitud).toFixed(5)}</p>
                    )}
                    <p>
                      <strong>Riesgo sugerido</strong>{" "}
                      <span className={`zr-riesgo-pill zr-riesgo-${(solicitudActiva.nivel_riesgo_sugerido || "medio").toLowerCase()}`}>
                        {solicitudActiva.nivel_riesgo_sugerido || "Sin sugerencia"}
                      </span>
                    </p>
                    <p><strong>Descripción</strong><br />{solicitudActiva.descripcion}</p>
                    <p><small>Solicitado por: {solicitudActiva.solicitante_nombre || `#${solicitudActiva.id_ciudadano}`}</small></p>
                  </div>

                  <label>
                    Nivel de riesgo final
                    <select value={nivelFinalEval} onChange={(e) => setNivelFinalEval(e.target.value)}>
                      {["BAJO", "MEDIO", "ALTO", "EXTREMO"].map((n) => <option key={n}>{n}</option>)}
                    </select>
                  </label>

                  <label>
                    Observaciones de evaluación
                    <textarea
                      rows={3}
                      value={notaEvaluacion}
                      onChange={(e) => setNotaEvaluacion(e.target.value)}
                      placeholder="Agrega un comentario o motivo de aprobación/denegación…"
                    />
                  </label>

                  <div className="zr-eval-botones">
                    <div className="zr-eval-principales">
                      <button type="button" className="zr-boton zr-btn-aprobar" disabled={procesando} onClick={(e) => resolverSolicitud(e, "APROBADA")}>
                        ✓ Aprobar solicitud
                      </button>
                      <button type="button" className="zr-boton zr-btn-denegar" disabled={procesando} onClick={(e) => resolverSolicitud(e, "RECHAZADA")}>
                        ✕ Denegar solicitud
                      </button>
                    </div>
                    <button type="button" className="zr-boton zr-btn-eliminar" disabled={procesando} onClick={() => borrarSolicitud(solicitudActiva)}>
                      🗑 Eliminar
                    </button>
                  </div>
                </form>

                <div className="zr-form-col-der">
                  <span className="zr-campo-titulo">Ubicación solicitada</span>
                  <MapaSolicitud solicitud={solicitudActiva} nivelRiesgo={nivelFinalEval} />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="zr-sol-tabs" role="tablist" aria-label="Historial de solicitudes">
                <button type="button" className={`zr-boton ${tabSolicitudes === "PENDIENTE" ? "zr-primario" : "zr-secundario"}`} onClick={() => setTabSolicitudes("PENDIENTE")}>
                  Pendientes ({pendientes.length})
                </button>
                <button type="button" className={`zr-boton ${tabSolicitudes === "APROBADA" ? "zr-primario" : "zr-secundario"}`} onClick={() => setTabSolicitudes("APROBADA")}>
                  Historial de aprobadas ({aprobadas.length})
                </button>
                <button type="button" className={`zr-boton ${tabSolicitudes === "RECHAZADA" ? "zr-primario" : "zr-secundario"}`} onClick={() => setTabSolicitudes("RECHAZADA")}>
                  Historial de denegadas ({denegadas.length})
                </button>
              </div>

              {tabSolicitudes === "PENDIENTE" && (
                !pendientes.length ? (
                  <p>No hay solicitudes pendientes.</p>
                ) : (
                  <div className="zr-grid">
                    {pendientes.map((s) => (
                      <article className="zr-tarjeta" key={s.id_solicitud}>
                        <div className="zr-tarjeta-superior">
                          <h3>{s.nombre}</h3>
                          <span className="zr-pill-pendiente">Pendiente</span>
                        </div>
                        <p><strong>Ubicación:</strong> {s.ubicacion}</p>
                        {s.latitud != null && <p><strong>Latitud:</strong> {Number(s.latitud).toFixed(5)} · <strong>Longitud:</strong> {Number(s.longitud).toFixed(5)}</p>}
                        <p><strong>Riesgo sugerido:</strong> {s.nivel_riesgo_sugerido || "Sin sugerencia"}</p>
                        <p>{s.descripcion}</p>
                        <p><small>Por {s.solicitante_nombre} · {s.fecha_solicitud ? new Date(s.fecha_solicitud).toLocaleString("es-BO") : ""}</small></p>
                        <div className="zr-acciones">
                          <button type="button" className="zr-boton zr-primario" onClick={() => abrirEvaluacion(s)}>Evaluar solicitud</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )
              )}

              {tabSolicitudes === "APROBADA" && (
                !aprobadas.length ? (
                  <p>Aún no hay solicitudes aprobadas.</p>
                ) : (
                  <div className="zr-tabla-contenedor">
                    <table className="zr-tabla">
                      <thead>
                        <tr><th>Zona</th><th>Ubicación</th><th>Solicitante</th><th>Observación</th><th>Evaluado por</th><th>Fecha</th><th>Acciones</th></tr>
                      </thead>
                      <tbody>
                        {aprobadas.map((s) => (
                          <tr key={s.id_solicitud}>
                            <td><strong>{s.nombre}</strong></td>
                            <td>{s.ubicacion}</td>
                            <td>{s.solicitante_nombre}</td>
                            <td>{s.observacion_admin || "—"}</td>
                            <td>{s.evaluador_nombre || "—"}</td>
                            <td>{s.fecha_evaluacion ? new Date(s.fecha_evaluacion).toLocaleString("es-BO") : "—"}</td>
                            <td>
                              <button type="button" className="zr-boton zr-secundario" onClick={() => irAVista("mapa")}>Ver en mapa</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {tabSolicitudes === "RECHAZADA" && (
                !denegadas.length ? (
                  <p>Aún no hay solicitudes denegadas.</p>
                ) : (
                  <div className="zr-tabla-contenedor">
                    <table className="zr-tabla">
                      <thead>
                        <tr><th>Zona</th><th>Ubicación</th><th>Riesgo sugerido</th><th>Solicitante</th><th>Motivo de denegación</th><th>Evaluado por</th><th>Fecha</th><th>Acciones</th></tr>
                      </thead>
                      <tbody>
                        {denegadas.map((s) => (
                          <tr key={s.id_solicitud}>
                            <td><strong>{s.nombre}</strong></td>
                            <td>{s.ubicacion}</td>
                            <td>{s.nivel_riesgo_sugerido || "—"}</td>
                            <td>{s.solicitante_nombre}</td>
                            <td>{s.observacion_admin || "—"}</td>
                            <td>{s.evaluador_nombre || "—"}</td>
                            <td>{s.fecha_evaluacion ? new Date(s.fecha_evaluacion).toLocaleString("es-BO") : "—"}</td>
                            <td>
                              <button type="button" className="zr-boton zr-secundario" disabled={procesando} onClick={() => borrarSolicitud(s)}>Eliminar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </>
          )}
        </section>}

        {puedeVerInspecciones && vistaActiva === "historial-inspecciones" && (() => {
          const listaInsp = todasInspecciones.filter(
            (i) =>
              (filtroZonaInsp === "TODAS" || String(i.id_zona) === filtroZonaInsp) &&
              (filtroNivelInsp === "TODOS" || i.nivel_riesgo_observado === filtroNivelInsp)
          );
          return (
            <section className="zr-panel">
              <div className="zr-clima-header">
                <div>
                  <h2>Historial de inspecciones ({listaInsp.length})</h2>
                  <p className="zr-ayuda-gps">Registro completo de inspecciones en campo realizadas por los bomberos.</p>
                </div>
                <button type="button" className="zr-boton zr-secundario" onClick={cargarHistorialInspecciones}>Actualizar historial</button>
              </div>
              <div className="zr-filtros-barra">
                <label className="zr-filtro-depto">
                  <span>Zona</span>
                  <select value={filtroZonaInsp} onChange={(e) => setFiltroZonaInsp(e.target.value)}>
                    <option value="TODAS">Todas las zonas</option>
                    {zonas.map((z) => <option key={z.id_zona} value={String(z.id_zona)}>{z.nombre}</option>)}
                  </select>
                </label>
                <label className="zr-filtro-depto">
                  <span>Nivel observado</span>
                  <select value={filtroNivelInsp} onChange={(e) => setFiltroNivelInsp(e.target.value)}>
                    <option value="TODOS">Todos</option>
                    {["BAJO", "MEDIO", "ALTO", "EXTREMO"].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
              {!listaInsp.length ? (
                <p>No hay inspecciones registradas con esos filtros.</p>
              ) : (
                <div className="zr-tabla-contenedor">
                  <table className="zr-tabla">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Zona</th>
                        <th>Inspector</th>
                        <th>Nivel observado</th>
                        <th>Observaciones y recomendaciones</th>
                        <th>Material combustible y acceso</th>
                        <th>Evidencias</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaInsp.map((i) => (
                        <tr key={i.id_inspeccion}>
                          <td>{i.fecha_inspeccion ? new Date(i.fecha_inspeccion).toLocaleString("es-BO") : "—"}</td>
                          <td>
                            <strong>{i.zona_nombre}</strong>
                            {i.zona_ubicacion && <><br /><small>{i.zona_ubicacion}</small></>}
                          </td>
                          <td>{i.inspector_nombre || `Inspector #${i.id_inspector}`}</td>
                          <td>
                            <span className={`zr-riesgo-pill zr-riesgo-${(i.nivel_riesgo_observado || "medio").toLowerCase()}`}>
                              {i.nivel_riesgo_observado}
                            </span>
                          </td>
                          <td>
                            {i.observaciones}
                            {i.recomendaciones && <><br /><small><strong>Rec.:</strong> {i.recomendaciones}</small></>}
                          </td>
                          <td>
                            {i.material_combustible?.length ? i.material_combustible.join(", ") : "—"}
                            {i.accesibilidad && <><br /><small>Acceso: {i.accesibilidad}</small></>}
                          </td>
                          <td>
                            {i.fotos?.length ? (
                              <div className="zr-fotos-preview">
                                {i.fotos.map((src, idx) => (
                                  <a key={idx} href={src} target="_blank" rel="noreferrer">
                                    <img src={src} alt={`Evidencia ${idx + 1}`} className="zr-foto-thumb" />
                                  </a>
                                ))}
                              </div>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })()}

        {esBombero && vistaActiva === "inspeccion" && <section className="zr-panel">
          <h2>Registrar inspección</h2>
          <div className="zr-form-grid">
            <form className="zr-form-col-izq" onSubmit={guardarInspeccion}>
              <label>
                Zona
                <select required value={zonaInspeccion} onChange={(e) => cargarInspecciones(e.target.value)}>
                  <option value="">Selecciona una zona</option>
                  {zonas.map((z) => <option key={z.id_zona} value={z.id_zona}>{z.nombre}</option>)}
                </select>
              </label>

              <div className="zr-campo-etiqueta">
                <span>Nivel de riesgo observado</span>
                <div className="zr-chips" role="group" aria-label="Nivel de riesgo observado">
                  {["BAJO", "MEDIO", "ALTO", "EXTREMO"].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`zr-chip${formInspeccion.nivel_riesgo_observado === n ? " activo" : ""}`}
                      onClick={() => setFormInspeccion({ ...formInspeccion, nivel_riesgo_observado: n })}
                    >
                      <span className="zr-dot" style={{ background: COLORES_RIESGO[n] }} />
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <label>Observaciones<textarea required rows={3} value={formInspeccion.observaciones} onChange={(e) => setFormInspeccion({ ...formInspeccion, observaciones: e.target.value })} placeholder="Describe lo observado en la zona" /></label>
              <label>Recomendaciones<textarea rows={2} value={formInspeccion.recomendaciones} onChange={(e) => setFormInspeccion({ ...formInspeccion, recomendaciones: e.target.value })} placeholder="Medidas preventivas recomendadas" /></label>

              <div className="zr-campo-etiqueta">
                <span>Material combustible identificado</span>
                <div className="zr-chips">
                  {[...new Set([...MATERIALES_COMBUSTIBLES, ...formInspeccion.material_combustible])].map((mat) => (
                    <button
                      key={mat}
                      type="button"
                      className={`zr-chip${formInspeccion.material_combustible.includes(mat) ? " activo" : ""}`}
                      onClick={() => alternarMaterial(mat)}
                    >
                      {mat}
                    </button>
                  ))}
                </div>
                <div className="zr-material-manual">
                  <input
                    type="text"
                    value={combustibleManual}
                    onChange={(e) => setCombustibleManual(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        agregarMaterialManual();
                      }
                    }}
                    placeholder="Otro combustible manual (ej. llantas, madera)"
                    aria-label="Otro material combustible"
                  />
                  <button type="button" className="zr-boton zr-secundario" onClick={agregarMaterialManual}>
                    + Agregar
                  </button>
                </div>
              </div>

              <div className="zr-campo-etiqueta">
                <span>Accesibilidad de la zona</span>
                <div className="zr-chips">
                  {ACCESIBILIDADES.map((acc) => (
                    <button
                      key={acc}
                      type="button"
                      className={`zr-chip${formInspeccion.accesibilidad === acc ? " activo" : ""}`}
                      onClick={() => setFormInspeccion({ ...formInspeccion, accesibilidad: acc })}
                    >
                      {acc}
                    </button>
                  ))}
                </div>
              </div>

              <div className="zr-campo-etiqueta">
                <span>Evidencias · Subir fotos de la inspección</span>
                <label className="zr-dropzone">
                  Cargar fotografías (máx. 4)
                  <input type="file" accept="image/*" multiple onChange={adjuntarFotosInspeccion} hidden />
                </label>
                {formInspeccion.fotos.length > 0 && (
                  <div className="zr-fotos-preview">
                    {formInspeccion.fotos.map((src, idx) => (
                      <div key={idx} className="zr-foto-item">
                        <img src={src} alt={`Evidencia ${idx + 1}`} />
                        <button
                          type="button"
                          aria-label="Quitar foto"
                          onClick={() => setFormInspeccion((a) => ({ ...a, fotos: a.fotos.filter((_, k) => k !== idx) }))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button className="zr-boton zr-primario" disabled={procesando || !zonaInspeccion}>Guardar inspección</button>
            </form>

            <div className="zr-form-col-der">
              <MapaInspeccion
                zonas={zonas}
                idZonaSeleccionada={zonaInspeccion}
                onSeleccionarZona={(id) => cargarInspecciones(id)}
              />
              <h3 className="zr-insp-titulo">Inspecciones de esta zona</h3>
              {!zonaInspeccion ? (
                <p className="zr-ayuda-gps">Selecciona una zona en el formulario o haz clic en el mapa para acercar y ver su historial de inspecciones.</p>
              ) : !inspecciones.length ? (
                <p className="zr-ayuda-gps">Aún no hay inspecciones registradas para esta zona.</p>
              ) : (
                <div className="zr-timeline">
                  <span className="zr-timeline-etiqueta">Timeline</span>
                  {inspecciones.map((i, idx) => {
                    const color = COLORES_RIESGO[i.nivel_riesgo_observado] || "#eab308";
                    const lado = idx % 2 === 0 ? "izq" : "der";
                    const activa = inspeccionActivaId === i.id_inspeccion;
                    return (
                      <div key={i.id_inspeccion} className={`zr-tl-item zr-tl-${lado}`}>
                        <span className="zr-tl-dot" style={{ background: color }} />
                        <button
                          type="button"
                          className={`zr-tl-card${activa ? " activa" : ""}`}
                          onClick={() => setInspeccionActivaId(i.id_inspeccion)}
                        >
                          <strong>{i.fecha_inspeccion ? new Date(i.fecha_inspeccion).toLocaleDateString("es-BO") : ""}</strong>
                          <span>{i.inspector_nombre || `Inspector #${i.id_inspector}`}</span>
                          <span className="zr-tl-nivel">
                            <i className="zr-dot" style={{ background: color }} />
                            {i.nivel_riesgo_observado}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {(() => {
                const detalle = inspecciones.find((i) => i.id_inspeccion === inspeccionActivaId);
                if (!detalle) return null;
                return (
                  <article className="zr-tarjeta zr-tl-detalle">
                    <div className="zr-tarjeta-superior">
                      <strong>{detalle.inspector_nombre || `Inspector #${detalle.id_inspector}`}</strong>
                      <small>{detalle.fecha_inspeccion ? new Date(detalle.fecha_inspeccion).toLocaleString("es-BO") : ""}</small>
                    </div>
                    <p><strong>Observaciones:</strong> {detalle.observaciones}</p>
                    {detalle.recomendaciones && <p><strong>Recomendaciones:</strong> {detalle.recomendaciones}</p>}
                    {detalle.material_combustible?.length > 0 && (
                      <p><strong>Material combustible:</strong> {detalle.material_combustible.join(", ")}</p>
                    )}
                    {detalle.accesibilidad && <p><strong>Accesibilidad:</strong> {detalle.accesibilidad}</p>}
                    {detalle.fotos?.length > 0 && (
                      <div className="zr-fotos-preview">
                        {detalle.fotos.map((src, idx) => (
                          <img key={idx} src={src} alt={`Inspección ${idx + 1}`} className="zr-foto-thumb" />
                        ))}
                      </div>
                    )}
                  </article>
                );
              })()}
            </div>
          </div>
        </section>}

        {vistaActiva === "catalogo" && <section className="zr-panel zr-zonas-panel">
          <h2>Zonas registradas ({zonasFiltradas.length}{zonasFiltradas.length !== zonas.length ? ` de ${zonas.length}` : ""})</h2>
          {renderFiltros()}

          {zonaEnMapa && (
            <div className="zr-mapa">
              <div className="zr-tarjeta-superior">
                <h3>Mapa: {zonaEnMapa.nombre}</h3>
                <button className="zr-boton zr-secundario" onClick={() => setZonaEnMapa(null)}>Cerrar mapa</button>
              </div>
              {(() => {
                const punto = Array.isArray(zonaEnMapa.coordenadas) ? zonaEnMapa.coordenadas[0] : null;
                const lat = Number(punto?.lat);
                const lng = Number(punto?.lng);
                const tienePunto = Number.isFinite(lat) && Number.isFinite(lng);
                const src = tienePunto
                  ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.03}%2C${lat - 0.03}%2C${lng + 0.03}%2C${lat + 0.03}&layer=mapnik&marker=${lat}%2C${lng}`
                  : `https://www.google.com/maps?q=${encodeURIComponent(zonaEnMapa.ubicacion)}&output=embed`;
                const enlaceMapa = tienePunto
                  ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=13/${lat}/${lng}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(zonaEnMapa.ubicacion)}`;
                return <><iframe title={`Mapa de ${zonaEnMapa.nombre}`} src={src} loading="lazy" /><a href={enlaceMapa} target="_blank" rel="noreferrer">Abrir ubicación en el mapa</a></>;
              })()}
              <p>La ubicación del mapa depende de las coordenadas GPS registradas para la zona.</p>
            </div>
          )}

          {cargando ? (
            <p>Cargando zonas...</p>
          ) : zonas.length === 0 ? (
            <p>No se encontraron zonas registradas.</p>
          ) : zonasFiltradas.length === 0 ? (
            <p>No se encontraron zonas que coincidan con los filtros aplicados.</p>
          ) : (
            <div className="zr-grid">
              {zonasFiltradas.map((zona) => (
                <article className="zr-tarjeta" key={zona.id_zona}>
                  <div className="zr-tarjeta-superior">
                    <h3>{zona.nombre}</h3>
                    <div className="zr-tarjeta-badges">
                      {zona.origen_ciudadano && <span className="zr-badge-ciudadano">👤 Reporte ciudadano</span>}
                      <span className={`zr-estado ${
                        zona.estado === "Activa" ? "zr-activa" : zona.estado === "Alerta Emitida" ? "zr-alerta-emitida" : "zr-inactiva"
                      }`}>
                        {zona.estado || "Sin estado"}
                      </span>
                    </div>
                  </div>

                  <p><strong>Ubicación:</strong> {zona.ubicacion}</p>
                  {zona.latitud != null && <p><strong>Latitud:</strong> {Number(zona.latitud).toFixed(5)} · <strong>Longitud:</strong> {Number(zona.longitud).toFixed(5)}</p>}
                  <p><strong>Riesgo:</strong> {zona.nivel_riesgo}</p>
                  <p><strong>Departamento:</strong> {departamentoDeZona(zona) || "—"}</p>
                  <p><strong>Vegetación:</strong> {zona.tipo_vegetacion || "No especificada"}</p>
                  <p><strong>Clima:</strong> {detalleClima(zona)}</p>

                  <div className="zr-acciones">
                    <button className="zr-boton zr-secundario" onClick={() => setZonaEnMapa(zona)}>Ver mapa</button>
                    {(esAdmin || usuario?.rol === "OPERADOR") && zona.estado !== "Alerta Emitida" && ["ALTO", "EXTREMO"].includes(zona.nivel_riesgo) && <button className="zr-boton zr-secundario" onClick={() => { setZonaAlerta(zona); setVistaActiva("alerta"); }}>Emitir alerta</button>}
                    {esAdmin && (
                      <>
                        <button
                          className="zr-boton zr-primario"
                          disabled={procesando}
                          onClick={() => abrirEdicion(zona)}
                        >
                          Modificar
                        </button>

                        <button
                          className="zr-boton zr-secundario"
                          disabled={procesando}
                          onClick={() => borrarZona(zona)}
                        >
                          Eliminar
                        </button>

                        {["Activa", "Inactiva"].includes(zona.estado) && (
                          <button
                            className="zr-boton zr-secundario"
                            onClick={() => abrirCambioEstado(zona)}
                          >
                            {zona.estado === "Activa" ? "Inactivar" : "Activar"}
                          </button>
                        )}
                      </>
                    )}

                    {esAdmin && (
                      <button
                        className="zr-boton zr-secundario"
                        onClick={() => abrirHistorial(zona)}
                      >
                        Ver historial
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>}

        {zonaAlerta && vistaActiva === "alerta" && <section className="zr-panel"><h2>Alerta preventiva: {zonaAlerta.nombre}</h2><form className="zr-formulario" onSubmit={guardarAlerta}><label>Mensaje de alerta<textarea rows={3} value={mensajeAlerta} onChange={(e) => setMensajeAlerta(e.target.value)} placeholder="Describe la recomendación preventiva" /></label><div className="zr-acciones"><button className="zr-boton zr-primario" disabled={procesando}>Emitir alerta {zonaAlerta.nivel_riesgo === "EXTREMO" ? "roja" : "naranja"}</button><button type="button" className="zr-boton zr-secundario" onClick={() => { setZonaAlerta(null); setVistaActiva("catalogo"); }}>Cancelar</button></div></form></section>}

        {zonaEditando && vistaActiva === "modificar" && (
          <section className="zr-panel">
            <h2>Modificar: {zonaEditando.nombre}</h2>
            <form onSubmit={guardarEdicion} className="zr-form-grid">
              <div className="zr-form-col-izq">
                <label>
                  Nombre <small className="zr-opcional">(opcional, se actualiza si cambias la zona en el mapa)</small>
                  <input
                    value={formulario.nombre}
                    onChange={(e) => {
                      setNombreManualEdicion(e.target.value.trim() !== "");
                      setFormulario({ ...formulario, nombre: e.target.value });
                    }}
                  />
                </label>

                <label>
                  Ubicación (zona, calle y departamento)
                  <input
                    required
                    value={formulario.ubicacion}
                    onChange={(e) =>
                      setFormulario({ ...formulario, ubicacion: e.target.value })
                    }
                  />
                </label>
                {(() => {
                  const c = centroide(puntosEdicion);
                  return c ? (
                    <p className="zr-gps-listo">
                      Latitud: {c.lat.toFixed(5)} · Longitud: {c.lng.toFixed(5)}
                    </p>
                  ) : null;
                })()}

                <label>
                  Descripción
                  <textarea
                    rows={2}
                    value={formulario.descripcion}
                    onChange={(e) =>
                      setFormulario({ ...formulario, descripcion: e.target.value })
                    }
                  />
                </label>

                <div className="zr-campos-dobles">
                  <label>
                    Nivel de riesgo
                    <select value={formulario.nivel_riesgo} onChange={(e) => setFormulario({ ...formulario, nivel_riesgo: e.target.value })}>
                      {["BAJO", "MEDIO", "ALTO", "EXTREMO"].map((nivel) => <option key={nivel}>{nivel}</option>)}
                    </select>
                  </label>

                  <div className="zr-campo-etiqueta">
                    <span>Tipo de vegetación</span>
                    <SelectorVegetacion
                      value={formulario.tipo_vegetacion}
                      opcionesExistentes={tiposVegetacion}
                      onChange={(valor) => setFormulario((a) => ({ ...a, tipo_vegetacion: valor }))}
                    />
                  </div>
                </div>

                <fieldset className="zr-clima-campos">
                  <legend>Condiciones climáticas de la zona</legend>
                  <div className="zr-campos-triples">
                    <label>Temperatura (°C)<input type="number" step="any" min="-30" max="60" value={formulario.temperatura ?? ""} onChange={(e) => setFormulario({ ...formulario, temperatura: e.target.value })} /></label>
                    <label>Humedad (%)<input type="number" step="any" min="0" max="100" value={formulario.humedad ?? ""} onChange={(e) => setFormulario({ ...formulario, humedad: e.target.value })} /></label>
                    <label>Viento (km/h)<input type="number" step="any" min="0" max="300" value={formulario.velocidad_viento ?? ""} onChange={(e) => setFormulario({ ...formulario, velocidad_viento: e.target.value })} /></label>
                  </div>
                  <button type="button" className="zr-boton zr-secundario" disabled={procesando} onClick={() => autocompletarClima(formulario, setFormulario)}>☁️ Autocompletar con el clima actual</button>
                </fieldset>

                <details className="zr-coordenadas-manuales">
                  <summary>Ingresar coordenadas manualmente (JSON)</summary>
                  <label>
                    Ubicación GPS o puntos del polígono
                    <textarea rows={4} value={formulario.coordenadas || ""} onChange={(e) => setFormulario({ ...formulario, coordenadas: e.target.value })} placeholder={'[{"lat": -17.30, "lng": -66.19}] o una lista de 3+ puntos'} />
                  </label>
                </details>

                <div className="zr-acciones">
                  <button className="zr-boton zr-primario" disabled={procesando}>
                    Guardar cambios
                  </button>
                  <button
                    type="button"
                    className="zr-boton zr-secundario"
                    onClick={() => { setZonaEditando(null); setVistaActiva("catalogo"); }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              <div className="zr-form-col-der">
                <span className="zr-campo-titulo">Ubicación y polígono de la zona</span>
                <MapaSelectorZona
                  modo="poligono"
                  altura={540}
                  puntos={puntosEdicion}
                  color={COLORES_RIESGO[formulario.nivel_riesgo]}
                  onChange={(pts) => setFormulario((a) => ({ ...a, coordenadas: JSON.stringify(pts, null, 2) }))}
                  onDireccionDetectada={(info) =>
                    setFormulario((a) => ({
                      ...a,
                      ubicacion: info.ubicacion,
                      nombre: nombreManualEdicion ? a.nombre : info.nombre,
                    }))
                  }
                />
              </div>
            </form>
          </section>
        )}

        {zonaEstado && vistaActiva === "estado" && (
          <section className="zr-panel">
            <h2>
              {zonaEstado.estado === "Activa" ? "Inactivar" : "Activar"}
              {" "}{zonaEstado.nombre}
            </h2>
            <form onSubmit={guardarCambioEstado} className="zr-formulario">
              <label>
                Motivo del cambio
                <textarea
                  required
                  rows={3}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Explique por qué cambiará el estado de esta zona"
                />
              </label>

              <div className="zr-acciones">
                <button
                  className="zr-boton zr-primario"
                  disabled={procesando || !motivo.trim()}
                >
                  Confirmar cambio
                </button>
                <button
                  type="button"
                  className="zr-boton zr-secundario"
                  onClick={() => { setZonaEstado(null); setVistaActiva("catalogo"); }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        )}

        {zonaHistorial && vistaActiva === "historial" && (
          <section className="zr-panel">
            <h2>Historial: {zonaHistorial.nombre}</h2>

            {cargandoHistorial ? (
              <p>Cargando historial...</p>
            ) : historial.length === 0 ? (
              <p>Esta zona no tiene cambios registrados.</p>
            ) : (
              <div className="zr-tabla-contenedor">
                <table className="zr-tabla">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Estado anterior</th>
                      <th>Estado nuevo</th>
                      <th>Usuario</th>
                      <th>Detalle / Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((registro) => (
                      <tr key={registro.id_historial}>
                        <td>{new Date(registro.fecha_cambio).toLocaleString("es-BO")}</td>
                        <td>{registro.estado_anterior}</td>
                        <td>{registro.estado_nuevo}</td>
                        <td>#{registro.id_usuario}</td>
                        <td>{registro.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              className="zr-boton zr-secundario"
              onClick={() => { setZonaHistorial(null); setVistaActiva("catalogo"); }}
            >
              Cerrar historial
            </button>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
