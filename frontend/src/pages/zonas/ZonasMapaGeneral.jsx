import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import DashboardClimaPanel from "../../components/zonas/DashboardClimaPanel";
import { listarAreasQuemadas, listarFocosSatelitales } from "../../services/zonasService";
import {
  ESCALAS,
  cuadriculaNacional,
  generarImagenBolivia,
  gradienteCss,
  interpolarValor,
  nivelDesdeIndice,
} from "../../services/climaService";
import {
  CENTRO_BOLIVIA,
  DEPARTAMENTOS,
  ZOOM_BOLIVIA,
  centroide,
  departamentoDeZona,
  puntoEnBolivia,
  puntosValidos,
} from "../../utils/geoBolivia";

export const COLORES_RIESGO = {
  BAJO: "#22c55e",
  MEDIO: "#eab308",
  ALTO: "#f97316",
  EXTREMO: "#ef4444",
};

const ANALISIS = [
  { grupo: "Predicción de riesgo de incendios", opciones: [
    { id: "riesgo0", etiqueta: "Riesgo hoy", escala: "riesgo" },
    { id: "riesgo24", etiqueta: "Riesgo próximas 24 horas", escala: "riesgo" },
    { id: "riesgo48", etiqueta: "Riesgo próximas 48 horas", escala: "riesgo" },
  ] },
  { grupo: "Clima", opciones: [
    { id: "viento", etiqueta: "Viento (km/h)", escala: "viento" },
    { id: "temperatura", etiqueta: "Temperatura (°C)", escala: "temperatura" },
    { id: "humedad", etiqueta: "Humedad relativa (%)", escala: "humedad" },
    { id: "precipitacion", etiqueta: "Precipitación acumulada (mm)", escala: "precipitacion" },
  ] },
];
const OPCIONES_ANALISIS = ANALISIS.flatMap((g) => g.opciones);

const COLOR_FOCO = (cantidad) => (cantidad > 100 ? "#ef4444" : cantidad > 10 ? "#facc15" : "#3b82f6");

const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmt = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n).toFixed(d) : "—");

function formatoFecha(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-BO", {
      timeZone: "America/La_Paz",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function valorCelda(celda, analisis) {
  switch (analisis) {
    case "riesgo0": return celda.riesgo[0];
    case "riesgo24": return celda.riesgo[24];
    case "riesgo48": return celda.riesgo[48];
    case "viento": return celda.actual.viento;
    case "temperatura": return celda.actual.temp;
    case "humedad": return celda.actual.hum;
    case "precipitacion": return celda.actual.lluvia24;
    default: return null;
  }
}

function agruparFocos(focos, zoom) {
  if (zoom >= 12) return focos.map((f) => ({ cluster: false, focos: [f], lat: f.lat, lng: f.lng }));
  const celda = 6 / 2 ** (zoom - 4);
  const mapa = new Map();
  focos.forEach((f) => {
    const clave = `${Math.floor(f.lat / celda)}:${Math.floor(f.lng / celda)}`;
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave).push(f);
  });
  return [...mapa.values()].map((grupo) => ({
    cluster: grupo.length > 1,
    focos: grupo,
    lat: grupo.reduce((s, f) => s + f.lat, 0) / grupo.length,
    lng: grupo.reduce((s, f) => s + f.lng, 0) / grupo.length,
  }));
}

export default function ZonasMapaGeneral({
  zonas = [],
  climaZonas = {},
  destino = null,
  analisisInicial = "riesgo0",
  modoClima = false,
}) {
  const contenedor = useRef(null);
  const mapaRef = useRef(null);
  const basesRef = useRef({});
  const capasRef = useRef({});
  const capasZonaRef = useRef(new Map());
  const firmaZonasRef = useRef("");
  const hoverCfgRef = useRef({ analisis: analisisInicial, celdas: [] });

  const [capas, setCapas] = useState({ zonas: true, focos: true, quemadas: false });
  const [analisis, setAnalisis] = useState(analisisInicial);
  const [base, setBase] = useState("calle");
  const [zoom, setZoom] = useState(ZOOM_BOLIVIA);
  const [focos, setFocos] = useState({ estado: "idle", datos: null, error: "" });
  const [rejilla, setRejilla] = useState({ estado: "idle", datos: [], error: "" });
  const [quemadas, setQuemadas] = useState({ estado: "idle", datos: null, error: "" });
  const [anio, setAnio] = useState("todos");
  const [lecturaCursor, setLecturaCursor] = useState("");

  const conteo = useMemo(() => {
    const total = { BAJO: 0, MEDIO: 0, ALTO: 0, EXTREMO: 0 };
    zonas.forEach((z) => {
      if (total[z.nivel_riesgo] !== undefined && puntosValidos(z.coordenadas).length) total[z.nivel_riesgo] += 1;
    });
    return total;
  }, [zonas]);

  /* ----------------------------- Carga de datos ----------------------------- */

  async function cargarFocos(refrescar = false) {
    setFocos((a) => ({ ...a, estado: "cargando", error: "" }));
    try {
      const respuesta = await listarFocosSatelitales(1, refrescar);
      setFocos({ estado: "ok", datos: respuesta.data, error: "" });
    } catch (err) {
      setFocos({ estado: "error", datos: null, error: err.message });
    }
  }

  async function cargarRejilla() {
    setRejilla((a) => ({ ...a, estado: "cargando", error: "" }));
    try {
      setRejilla({ estado: "ok", datos: await cuadriculaNacional(), error: "" });
    } catch (err) {
      setRejilla({ estado: "error", datos: [], error: err.message || "No se pudo obtener el clima" });
    }
  }

  async function cargarQuemadas() {
    setQuemadas((a) => ({ ...a, estado: "cargando", error: "" }));
    try {
      const respuesta = await listarAreasQuemadas();
      setQuemadas({ estado: "ok", datos: respuesta.data, error: "" });
    } catch (err) {
      setQuemadas({ estado: "error", datos: null, error: err.message });
    }
  }

  useEffect(() => {
    if (capas.focos && focos.estado === "idle") cargarFocos();
  }, [capas.focos]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (capas.quemadas && quemadas.estado === "idle") cargarQuemadas();
  }, [capas.quemadas]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (analisis !== "ninguna" && rejilla.estado === "idle") cargarRejilla();
  }, [analisis]); // eslint-disable-line react-hooks/exhaustive-deps

  /* --------------------------------- Mapa base -------------------------------- */

  useEffect(() => {
    if (!contenedor.current || mapaRef.current) return undefined;
    const mapa = L.map(contenedor.current, { center: CENTRO_BOLIVIA, zoom: ZOOM_BOLIVIA });
    basesRef.current = {
      calle: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }),
      satelite: L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "&copy; Esri World Imagery", maxZoom: 19 }
      ),
    };
    basesRef.current.calle.addTo(mapa);
    mapa.createPane("rejilla").style.zIndex = 380;
    capasRef.current = {
      rejilla: L.layerGroup().addTo(mapa),
      quemadas: L.layerGroup().addTo(mapa),
      zonas: L.layerGroup().addTo(mapa),
      focos: L.layerGroup().addTo(mapa),
      destino: L.layerGroup().addTo(mapa),
    };
    mapa.on("zoomend", () => setZoom(mapa.getZoom()));
    mapa.on("mousemove", (e) => {
      const { analisis: act, celdas } = hoverCfgRef.current;
      const op = OPCIONES_ANALISIS.find((o) => o.id === act);
      if (!op || !celdas.length || !puntoEnBolivia(e.latlng.lat, e.latlng.lng)) {
        setLecturaCursor("");
        return;
      }
      const { lat, lng } = e.latlng;
      const val = interpolarValor(lat, lng, celdas, (c) => valorCelda(c, act));
      const temp = interpolarValor(lat, lng, celdas, (c) => c.actual.temp);
      const hum = interpolarValor(lat, lng, celdas, (c) => c.actual.hum);
      const viento = interpolarValor(lat, lng, celdas, (c) => c.actual.viento);
      const lluvia = interpolarValor(lat, lng, celdas, (c) => c.actual.lluvia24);
      const escObj = ESCALAS[op.escala];
      const principal =
        op.escala === "riesgo"
          ? `${op.etiqueta}: ${nivelDesdeIndice(val)}`
          : `${escObj.etiqueta}: ${fmt(val, act === "precipitacion" ? 1 : 0)} ${escObj.unidad}`;
      setLecturaCursor(
        `${principal} · 🌡️ ${fmt(temp, 1)} °C · 💧 ${fmt(hum)} % · 💨 ${fmt(viento)} km/h · 🌧️ ${fmt(lluvia, 1)} mm`
      );
    });
    mapa.on("mouseout", () => setLecturaCursor(""));
    mapaRef.current = mapa;
    const t = setTimeout(() => mapa.invalidateSize(), 150);
    return () => {
      clearTimeout(t);
      mapa.remove();
      mapaRef.current = null;
      capasRef.current = {};
    };
  }, []);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    Object.entries(basesRef.current).forEach(([id, capa]) => {
      if (id === base) {
        if (!mapa.hasLayer(capa)) capa.addTo(mapa).bringToBack();
      } else if (mapa.hasLayer(capa)) {
        mapa.removeLayer(capa);
      }
    });
  }, [base]);

  /* ------------------------------ Zonas de riesgo ----------------------------- */

  useEffect(() => {
    const mapa = mapaRef.current;
    const grupo = capasRef.current.zonas;
    if (!mapa || !grupo) return;
    grupo.clearLayers();
    capasZonaRef.current = new Map();
    if (!capas.zonas) return;

    const limites = [];
    zonas.forEach((zona) => {
      const puntos = puntosValidos(zona.coordenadas);
      if (!puntos.length) return;
      const color = COLORES_RIESGO[zona.nivel_riesgo] || "#64748b";
      const inactiva = zona.estado === "Inactiva";
      const clima = climaZonas[zona.id_zona];
      const datosClima = clima
        ? `🌡️ ${fmt(clima.temp, 1)} °C · 💧 ${fmt(clima.hum)} % · 💨 ${fmt(clima.viento)} km/h · 🌧️ ${fmt(clima.lluvia24, 1)} mm (24 h)<br/><small>Clima actual · Open-Meteo</small>`
        : `🌡️ ${fmt(zona.temperatura, 1)} °C · 💧 ${fmt(zona.humedad)} % · 💨 ${fmt(zona.velocidad_viento)} km/h<br/><small>Valores registrados</small>`;
      const etiquetaCiudadano = zona.origen_ciudadano
        ? `<span style="color:#0369a1;font-weight:700">👤 Reportada por ciudadano${zona.solicitado_por ? `: ${esc(zona.solicitado_por)}` : ""}</span><br/>`
        : "";
      const popup =
        `<strong>${esc(zona.nombre)}</strong><br/>${etiquetaCiudadano}${esc(zona.ubicacion)}<br/>` +
        `Departamento: ${esc(departamentoDeZona(zona) || "—")}<br/>` +
        `Riesgo: <b style="color:${color}">${esc(zona.nivel_riesgo)}</b> · ${esc(zona.estado || "Sin estado")}<br/>` +
        `${zona.tipo_vegetacion ? `Vegetación: ${esc(zona.tipo_vegetacion)}<br/>` : ""}${datosClima}`;
      const centro = puntos.length >= 3 ? centroide(puntos) : puntos[0];

      let principal;
      if (puntos.length >= 3) {
        principal = L.polygon(puntos.map((p) => [p.lat, p.lng]), {
          color,
          fillColor: color,
          fillOpacity: inactiva ? 0.1 : 0.3,
          weight: 2,
          dashArray: inactiva ? "6 4" : undefined,
        }).bindPopup(popup).addTo(grupo);
        puntos.forEach((p) => limites.push([p.lat, p.lng]));
      } else {
        limites.push([centro.lat, centro.lng]);
      }
      if (zona.origen_ciudadano) {
        L.circleMarker([centro.lat, centro.lng], {
          radius: 13,
          color: "#0284c7",
          weight: 2,
          dashArray: "3 3",
          fillOpacity: 0,
          interactive: false,
        }).addTo(grupo);
      }
      const marcador = L.circleMarker([centro.lat, centro.lng], {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: inactiva ? 0.5 : 1,
      })
        .bindTooltip(`${zona.origen_ciudadano ? "👤 " : ""}${esc(zona.nombre)} · ${esc(zona.nivel_riesgo)}`, { direction: "top", offset: [0, -8] })
        .bindPopup(popup)
        .addTo(grupo);
      capasZonaRef.current.set(zona.id_zona, principal || marcador);
    });

    const firma = zonas.map((z) => z.id_zona).join(",");
    if (firma !== firmaZonasRef.current) {
      firmaZonasRef.current = firma;
      if (limites.length === 1) mapa.setView(limites[0], 11);
      else if (limites.length > 1) mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 12 });
    }
  }, [zonas, climaZonas, capas.zonas]);

  /* ------------------------------ Búsqueda / destino --------------------------- */

  useEffect(() => {
    const mapa = mapaRef.current;
    const grupo = capasRef.current.destino;
    if (!mapa || !grupo) return;
    grupo.clearLayers();
    if (!destino) return;
    if (destino.tipo === "lugar") {
      const icono = L.divIcon({ className: "zr-vertice-wrapper", html: '<span class="zr-pin">📍</span>', iconSize: [28, 28], iconAnchor: [14, 26] });
      L.marker([destino.lat, destino.lng], { icon: icono })
        .bindTooltip(esc(String(destino.nombre || "").split(",").slice(0, 2).join(",")), { direction: "top", offset: [0, -24] })
        .addTo(grupo);
    }
    if (destino.bbox?.length === 4) {
      mapa.fitBounds([[destino.bbox[0], destino.bbox[2]], [destino.bbox[1], destino.bbox[3]]], { maxZoom: 17, padding: [20, 20] });
    } else if (destino.lat !== undefined) {
      mapa.flyTo([destino.lat, destino.lng], destino.zoom || 13, { duration: 0.8 });
    }
    if (destino.idZona) {
      setTimeout(() => capasZonaRef.current.get(destino.idZona)?.openPopup(), 900);
    }
  }, [destino]);

  /* ------------------------------- Focos de calor ------------------------------ */

  useEffect(() => {
    const mapa = mapaRef.current;
    const grupo = capasRef.current.focos;
    if (!mapa || !grupo) return;
    grupo.clearLayers();
    if (!capas.focos || !focos.datos?.focos?.length) return;

    agruparFocos(focos.datos.focos, zoom).forEach((nodo) => {
      if (!nodo.cluster) {
        const f = nodo.focos[0];
        L.circleMarker([f.lat, f.lng], { radius: 6, color: "#fff", weight: 1.5, fillColor: "#f97316", fillOpacity: 0.95 })
          .bindPopup(
            `<strong>🔥 Foco de calor</strong><br/>Sensor: ${esc(f.sensor)} (${esc(f.satelite || "—")})<br/>` +
              `Detectado: ${esc(f.fecha_local || "—")}<br/>Potencia (FRP): ${fmt(f.frp_mw, 1)} MW · Confianza: ${esc(f.confianza || "—")}<br/>` +
              `Departamento: ${esc(f.departamento || "—")}`
          )
          .addTo(grupo);
        return;
      }
      const total = nodo.focos.length;
      const tamano = Math.min(46, 28 + Math.log10(total + 1) * 10);
      const icono = L.divIcon({
        className: "zr-vertice-wrapper",
        html: `<div class="zr-foco-cluster" style="width:${tamano}px;height:${tamano}px;background:${COLOR_FOCO(total)}"><span>${total}</span></div>`,
        iconSize: [tamano, tamano],
        iconAnchor: [tamano / 2, tamano / 2],
      });
      L.marker([nodo.lat, nodo.lng], { icon: icono })
        .bindTooltip(`${total} focos de calor · clic para acercar`, { direction: "top" })
        .on("click", () => {
          const limites = nodo.focos.map((f) => [f.lat, f.lng]);
          mapa.fitBounds(limites, { padding: [50, 50], maxZoom: Math.min(zoom + 3, 12) });
        })
        .addTo(grupo);
    });
  }, [focos.datos, zoom, capas.focos]);

  /* -------------- Predicción y clima (degradado continuo en Bolivia) --------- */

  useEffect(() => {
    hoverCfgRef.current = { analisis, celdas: rejilla.datos };
    const grupo = capasRef.current.rejilla;
    if (!grupo) return;
    grupo.clearLayers();
    setLecturaCursor("");
    const opcion = OPCIONES_ANALISIS.find((o) => o.id === analisis);
    if (!opcion || !rejilla.datos.length) return;
    const escala = ESCALAS[opcion.escala];
    const { url, bounds } = generarImagenBolivia(rejilla.datos, (c) => valorCelda(c, analisis), escala);
    L.imageOverlay(url, bounds, { pane: "rejilla", opacity: 0.72, interactive: false }).addTo(grupo);
  }, [rejilla.datos, analisis]);

  /* -------------------------------- Áreas quemadas ----------------------------- */

  const aniosQuemadas = useMemo(() => {
    const d = quemadas.datos;
    if (!d) return [];
    const conjunto = new Set((d.superficie?.anios || []).map(String));
    d.incidentes.forEach((i) => i.anio && conjunto.add(String(i.anio)));
    return [...conjunto].sort((a, b) => b - a);
  }, [quemadas.datos]);

  const superficiePorDepto = useMemo(() => {
    const d = quemadas.datos;
    if (!d) return [];
    return (d.superficie?.departamentos || [])
      .map((dep) => {
        const valores = dep.valores || {};
        const ha = anio === "todos" ? Object.values(valores).reduce((s, v) => s + v, 0) : valores[anio] || 0;
        return { departamento: dep.departamento, ha };
      })
      .filter((x) => x.ha > 0)
      .sort((a, b) => b.ha - a.ha);
  }, [quemadas.datos, anio]);

  useEffect(() => {
    const grupo = capasRef.current.quemadas;
    if (!grupo) return;
    grupo.clearLayers();
    if (!capas.quemadas || !quemadas.datos) return;

    quemadas.datos.incidentes
      .filter((i) => anio === "todos" || String(i.anio) === anio)
      .forEach((i) => {
        L.circle([i.lat, i.lng], {
          radius: Math.max(i.radio_m, 900),
          color: "#7c2d12",
          weight: 1.5,
          fillColor: "#92400e",
          fillOpacity: 0.45,
        })
          .bindPopup(
            `<strong>Área quemada · incidente #${i.id}</strong><br/>${esc(i.ubicacion)}<br/>` +
              `Gravedad: ${esc(i.gravedad)} · Estado: ${esc(i.estado)}<br/>Inicio: ${esc(formatoFecha(i.fecha_inicio))}`
          )
          .addTo(grupo);
      });

    superficiePorDepto.forEach(({ departamento, ha }) => {
      const dep = DEPARTAMENTOS.find((d) => d.nombre === departamento);
      if (!dep) return;
      L.circle(dep.centro, {
        radius: Math.sqrt((ha * 10000) / Math.PI),
        color: "#7c2d12",
        weight: 2,
        dashArray: "8 6",
        fillColor: "#b45309",
        fillOpacity: 0.28,
      })
        .bindTooltip(`${esc(departamento)}: ${Math.round(ha).toLocaleString("es-BO")} ha quemadas (${anio === "todos" ? "acumulado" : anio})`, { sticky: true })
        .addTo(grupo);
    });
  }, [quemadas.datos, anio, capas.quemadas, superficiePorDepto]);

  /* ----------------------------------- Vista ---------------------------------- */

  const opcionAnalisis = OPCIONES_ANALISIS.find((o) => o.id === analisis);
  const escalaActiva = opcionAnalisis ? ESCALAS[opcionAnalisis.escala] : null;
  const resumenFocos = focos.datos;
  const gruposVisibles = modoClima ? ANALISIS.filter((g) => g.grupo === "Clima") : ANALISIS;

  return (
    <div className={`zr-mg${modoClima ? " zr-mg-clima" : ""}`}>
      <aside className="zr-mg-panel" aria-label="Capas del mapa">
        <h3>Capas</h3>
        <label className="zr-mg-opcion">
          <input type="checkbox" checked={capas.zonas} onChange={(e) => setCapas({ ...capas, zonas: e.target.checked })} />
          Zonas de riesgo
        </label>
        <label className="zr-mg-opcion">
          <input type="checkbox" checked={capas.focos} onChange={(e) => setCapas({ ...capas, focos: e.target.checked })} />
          🔥 Focos de calor (24 h)
        </label>
        <label className="zr-mg-opcion">
          <input type="checkbox" checked={capas.quemadas} onChange={(e) => setCapas({ ...capas, quemadas: e.target.checked })} />
          🟤 Áreas quemadas
        </label>

        {!modoClima && (
          <label className="zr-mg-opcion zr-mg-ninguna">
            <input type="radio" name="analisis" checked={analisis === "ninguna"} onChange={() => setAnalisis("ninguna")} />
            Sin capa de análisis
          </label>
        )}
        {gruposVisibles.map((g) => (
          <div key={g.grupo} className="zr-mg-grupo">
            <h3>{g.grupo}</h3>
            {g.opciones.map((o) => (
              <label key={o.id} className="zr-mg-opcion">
                <input type="radio" name="analisis" checked={analisis === o.id} onChange={() => setAnalisis(o.id)} />
                {o.etiqueta}
              </label>
            ))}
          </div>
        ))}

        <div className="zr-mg-grupo">
          <h3>Tipo de mapa</h3>
          <select className="zr-selector-capa" value={base} onChange={(e) => setBase(e.target.value)} aria-label="Tipo de mapa">
            <option value="calle">Mapa</option>
            <option value="satelite">Satélite</option>
          </select>
        </div>
      </aside>

      <div className="zr-mg-centro">
        <div className="zr-mg-lienzo">
          <div ref={contenedor} className="zr-mapa-leaflet" />
          {(rejilla.estado === "cargando" || focos.estado === "cargando" || quemadas.estado === "cargando") && (
            <span className="zr-mg-cargando">Cargando datos del mapa…</span>
          )}
          {lecturaCursor && <div className="zr-mg-hud">{lecturaCursor}</div>}
        </div>

        {!modoClima && (
        <div className="zr-mg-info">
          <section className="zr-mg-tarjeta">
            <h4>Nivel de riesgo de las zonas</h4>
            <div className="zr-leyenda">
              {Object.entries(COLORES_RIESGO).map(([nivel, color]) => (
                <span key={nivel} className="zr-leyenda-item">
                  <span className="zr-leyenda-color" style={{ background: color }} />
                  {nivel} ({conteo[nivel]})
                </span>
              ))}
            </div>
            <p className="zr-ayuda-gps">Mostrando {Object.values(conteo).reduce((s, v) => s + v, 0)} zonas con coordenadas GPS. Los polígonos se dibujan con 3 o más puntos; las zonas inactivas aparecen punteadas.</p>
          </section>

          {capas.focos && (
            <section className="zr-mg-tarjeta">
              <h4>🔥 Focos de calor · últimas 24 horas</h4>
              {focos.estado === "error" && <p className="zr-error">{focos.error}</p>}
              {resumenFocos && resumenFocos.estado !== "ok" && <p className="zr-ayuda-gps">{resumenFocos.mensaje || "Sin datos satelitales disponibles."}</p>}
              {resumenFocos && resumenFocos.estado === "ok" && (
                <>
                  <p className="zr-ayuda-gps">
                    Desde {formatoFecha(resumenFocos.desde)} hasta {formatoFecha(resumenFocos.hasta)} (hora de Bolivia).
                  </p>
                  <p className="zr-mg-total">Cantidad de focos encontrados: <strong>{resumenFocos.total}</strong></p>
                  <ul className="zr-mg-lista">
                    {Object.entries(resumenFocos.por_sensor).map(([sensor, n]) => (
                      <li key={sensor}>Focos para sensor {sensor}: <strong>{n}</strong></li>
                    ))}
                  </ul>
                  <div className="zr-leyenda">
                    <span className="zr-leyenda-item"><span className="zr-leyenda-color" style={{ background: "#f97316", borderRadius: "50%" }} />Foco (FC)</span>
                    <span className="zr-leyenda-item"><span className="zr-leyenda-color" style={{ background: "#3b82f6", borderRadius: "50%" }} />1 – 10</span>
                    <span className="zr-leyenda-item"><span className="zr-leyenda-color" style={{ background: "#facc15", borderRadius: "50%" }} />10 – 100</span>
                    <span className="zr-leyenda-item"><span className="zr-leyenda-color" style={{ background: "#ef4444", borderRadius: "50%" }} />&gt; 100</span>
                  </div>
                </>
              )}
              <button type="button" className="zr-boton zr-secundario" disabled={focos.estado === "cargando"} onClick={() => cargarFocos(true)}>
                Actualizar focos
              </button>
            </section>
          )}

          {escalaActiva && (
            <section className="zr-mg-tarjeta">
              <h4>{opcionAnalisis.etiqueta}</h4>
              {rejilla.estado === "error" && (
                <>
                  <p className="zr-error">{rejilla.error}</p>
                  <button type="button" className="zr-boton zr-secundario" onClick={cargarRejilla}>Reintentar</button>
                </>
              )}
              <div className="zr-mg-gradiente" style={{ background: gradienteCss(escalaActiva) }} />
              <div className="zr-mg-gradiente-etiquetas">
                <span>{escalaActiva.extremos ? escalaActiva.extremos[0] : `${escalaActiva.min} ${escalaActiva.unidad}`}</span>
                <span>{escalaActiva.extremos ? escalaActiva.extremos[1] : `${escalaActiva.max}+ ${escalaActiva.unidad}`}</span>
              </div>
              <p className="zr-ayuda-gps">
                {opcionAnalisis.escala === "riesgo"
                  ? "Mapa continuo estimado con temperatura, humedad, viento y lluvia pronosticados (Open-Meteo). Pasa el cursor sobre Bolivia para consultar el detalle."
                  : "Degradado continuo interpolado con datos actuales (Open-Meteo). Pasa el cursor sobre Bolivia para consultar los valores."}
              </p>
            </section>
          )}

          {capas.quemadas && (
            <section className="zr-mg-tarjeta">
              <h4>🟤 Áreas quemadas</h4>
              {quemadas.estado === "error" && <p className="zr-error">{quemadas.error}</p>}
              {quemadas.datos && (
                <>
                  <label className="zr-mg-anio">
                    Año
                    <select value={anio} onChange={(e) => setAnio(e.target.value)}>
                      <option value="todos">Todos</option>
                      {aniosQuemadas.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </label>
                  <p className="zr-ayuda-gps">
                    {quemadas.datos.incidentes.length} incidente(s) con ubicación registrados en el historial.
                  </p>
                  {superficiePorDepto.length ? (
                    <ul className="zr-mg-lista">
                      {superficiePorDepto.map((d) => (
                        <li key={d.departamento}>{d.departamento}: <strong>{Math.round(d.ha).toLocaleString("es-BO")} ha</strong></li>
                      ))}
                    </ul>
                  ) : (
                    <p className="zr-ayuda-gps">Aún no hay superficie quemada por departamento cargada para este periodo.</p>
                  )}
                </>
              )}
            </section>
          )}
        </div>
        )}
      </div>

      {modoClima && (
        <DashboardClimaPanel
          zonas={zonas}
          climaZonas={climaZonas}
          opcionAnalisis={opcionAnalisis}
          focos={focos}
          onActualizarFocos={() => cargarFocos(true)}
          rejillaError={rejilla.estado === "error" ? rejilla.error : ""}
          onReintentarRejilla={cargarRejilla}
        />
      )}
    </div>
  );
}
