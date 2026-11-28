// Clima y pronóstico con Open-Meteo (gratuito, sin clave) y búsqueda / geocodificación
// inversa con Nominatim (OpenStreetMap). Ambos se consultan directamente desde el navegador.

import { BBOX_BOLIVIA, FRONTERA, estimarDepartamento, invMercatorY, mercatorY, puntoEnBolivia } from "../utils/geoBolivia";

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
const NOMINATIM = "https://nominatim.openstreetmap.org";
const TZ = "America/La_Paz";
const LOTE = 40;

const limitar = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/* ----------------------------- Búsqueda de lugares ---------------------------- */

export async function buscarLugares(texto, { signal } = {}) {
  const url = `${NOMINATIM}/search?format=jsonv2&limit=8&countrycodes=bo&accept-language=es&addressdetails=1&q=${encodeURIComponent(texto)}`;
  const respuesta = await fetch(url, { signal });
  if (!respuesta.ok) throw new Error("No se pudo consultar el buscador de lugares");
  const datos = await respuesta.json();
  return datos.map((d) => ({
    id: `${d.osm_type}-${d.osm_id}`,
    nombre: d.display_name,
    lat: Number(d.lat),
    lng: Number(d.lon),
    tipo: d.type,
    address: d.address || null,
    bbox: d.boundingbox ? d.boundingbox.map(Number) : null, // [sur, norte, oeste, este]
  }));
}

export function formatearDireccion(datos, lat, lng) {
  const dir = datos?.address || {};
  const calle = dir.road || dir.pedestrian || dir.footway || dir.path || dir.cycleway || "";
  const zona = dir.neighbourhood || dir.suburb || dir.quarter || dir.city_district || dir.village || dir.hamlet || "";
  const ciudad = dir.city || dir.town || dir.municipality || dir.county || "";
  const departamento = dir.state || estimarDepartamento(lat, lng);

  const partes = [];
  [calle, zona, ciudad, departamento].forEach((p) => {
    const limpio = String(p || "").trim();
    if (limpio && !partes.some((x) => x.toLowerCase() === limpio.toLowerCase())) {
      partes.push(limpio);
    }
  });

  const ubicacion = partes.join(", ") || datos?.display_name || `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  const nombreCorto = zona && calle
    ? `${zona} — ${calle}`
    : zona || calle || ciudad || `Zona ${departamento}`;

  return {
    calle,
    zona,
    ciudad,
    departamento,
    ubicacion,
    nombre: nombreCorto.slice(0, 100),
  };
}

export async function ubicacionDePunto(lat, lng, { signal } = {}) {
  const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`;
  const respuesta = await fetch(url, { signal });
  if (!respuesta.ok) throw new Error("No se pudo obtener la dirección del punto");
  const datos = await respuesta.json();
  return formatearDireccion(datos, lat, lng);
}

/* ------------------------------- Peticiones clima ------------------------------ */

async function pedir(puntos, extra) {
  const lat = puntos.map((p) => p.lat.toFixed(3)).join(",");
  const lng = puntos.map((p) => p.lng.toFixed(3)).join(",");
  const url = `${OPEN_METEO}?latitude=${lat}&longitude=${lng}&timezone=${encodeURIComponent(TZ)}&wind_speed_unit=kmh&${extra}`;
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`El servicio de clima respondió ${respuesta.status}`);
  const datos = await respuesta.json();
  return Array.isArray(datos) ? datos : [datos];
}

async function pedirPorLotes(puntos, extra) {
  const lotes = [];
  for (let i = 0; i < puntos.length; i += LOTE) lotes.push(puntos.slice(i, i + LOTE));
  const respuestas = await Promise.all(lotes.map((lote) => pedir(lote, extra)));
  return respuestas.flat();
}

function indiceHoraActual(r) {
  const hora = `${String(r.current?.time || "").slice(0, 13)}:00`;
  const i = r.hourly?.time?.indexOf(hora) ?? -1;
  return i >= 0 ? i : 24;
}

function sumar(valores, desde, hasta) {
  let total = 0;
  for (let i = Math.max(0, desde); i <= hasta && i < valores.length; i += 1) total += Number(valores[i]) || 0;
  return Math.round(total * 10) / 10;
}

function actualDe(r) {
  const idx = indiceHoraActual(r);
  return {
    temp: r.current?.temperature_2m,
    hum: r.current?.relative_humidity_2m,
    viento: r.current?.wind_speed_10m,
    lluvia24: sumar(r.hourly?.precipitation || [], idx - 23, idx),
  };
}

/** Clima actual de una lista de puntos {lat, lng}: temp °C, hum %, viento km/h, lluvia24 mm. */
export async function climaActual(puntos) {
  if (!puntos.length) return [];
  const extra =
    "current=temperature_2m,relative_humidity_2m,wind_speed_10m&hourly=precipitation&past_days=1&forecast_days=1";
  const respuestas = await pedirPorLotes(puntos, extra);
  return respuestas.map(actualDe);
}

/* ------------------------------ Índice de riesgo ------------------------------- */

/**
 * Índice meteorológico de peligro de incendio (0–1) a partir de temperatura (°C), humedad (%),
 * viento (km/h) y lluvia acumulada en 24 h (mm). Es una estimación, no el modelo oficial.
 */
export function indiceRiesgo({ temp, hum, viento, lluvia24 }) {
  const calor = limitar((temp - 12) / 26);
  const sequedad = limitar((75 - hum) / 60);
  const rafaga = limitar(viento / 40);
  let indice = 0.35 * calor + 0.45 * sequedad + 0.2 * rafaga;
  if (lluvia24 >= 5) indice *= 0.35;
  else if (lluvia24 >= 1) indice *= 0.65;
  return limitar(indice);
}

export function nivelDesdeIndice(indice) {
  if (indice < 0.28) return "BAJO";
  if (indice < 0.45) return "MEDIO";
  if (indice < 0.62) return "ALTO";
  return "EXTREMO";
}

/* ----------------------------- Cuadrícula nacional ----------------------------- */

const PASO = 1; // grados
let cacheCuadricula = null;

function celdasBolivia() {
  const celdas = [];
  for (let lat = -22.5; lat <= -9.5; lat += PASO) {
    for (let lng = -69.5; lng <= -57.5; lng += PASO) {
      const m = PASO / 2;
      const esquinas = [[lat - m, lng - m], [lat - m, lng + m], [lat + m, lng - m], [lat + m, lng + m]];
      const dentro = esquinas.filter(([a, b]) => puntoEnBolivia(a, b)).length;
      if (puntoEnBolivia(lat, lng) || dentro >= 2) celdas.push({ lat, lng, paso: PASO });
    }
  }
  return celdas;
}

/**
 * Clima actual y riesgo estimado (hoy, +24 h y +48 h) para una cuadrícula que cubre Bolivia.
 * Cada celda: { lat, lng, paso, actual: {temp, hum, viento, lluvia24}, riesgo: {0, 24, 48} }.
 */
export async function cuadriculaNacional() {
  if (cacheCuadricula && Date.now() - cacheCuadricula.ts < 30 * 60 * 1000) return cacheCuadricula.datos;
  const celdas = celdasBolivia();
  const extra =
    "current=temperature_2m,relative_humidity_2m,wind_speed_10m" +
    "&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&past_days=1&forecast_days=3";
  const respuestas = await pedirPorLotes(celdas, extra);

  const datos = celdas.map((celda, i) => {
    const r = respuestas[i];
    const idx = indiceHoraActual(r);
    const h = r.hourly;
    const riesgoEn = (horas) => {
      const k = Math.min(idx + horas, h.time.length - 1);
      return indiceRiesgo({
        temp: h.temperature_2m[k],
        hum: h.relative_humidity_2m[k],
        viento: h.wind_speed_10m[k],
        lluvia24: sumar(h.precipitation, k - 23, k),
      });
    };
    return { ...celda, actual: actualDe(r), riesgo: { 0: riesgoEn(0), 24: riesgoEn(24), 48: riesgoEn(48) } };
  });
  cacheCuadricula = { ts: Date.now(), datos };
  return datos;
}

/* ---------------------------------- Escalas ----------------------------------- */

export const ESCALAS = {
  riesgo: {
    etiqueta: "Riesgo de incendios",
    unidad: "",
    min: 0,
    max: 1,
    stops: [[0, "#157515"], [0.28, "#6ac41c"], [0.45, "#f2e53a"], [0.62, "#f58a1f"], [0.8, "#d32020"], [1, "#780808"]],
    extremos: ["Bajo", "Extremo"],
  },
  temperatura: {
    etiqueta: "Temperatura",
    unidad: "°C",
    min: 0,
    max: 40,
    stops: [[0, "#3b4cc0"], [10, "#3fa7d6"], [18, "#5cc77a"], [25, "#f2e53a"], [32, "#f58a1f"], [40, "#c8201c"]],
  },
  humedad: {
    etiqueta: "Humedad relativa",
    unidad: "%",
    min: 0,
    max: 100,
    stops: [[0, "#b5341a"], [25, "#f2a33a"], [50, "#e8e66a"], [75, "#5cb8c9"], [100, "#1d4fa8"]],
  },
  viento: {
    etiqueta: "Velocidad del viento",
    unidad: "km/h",
    min: 0,
    max: 50,
    stops: [[0, "#4c1d95"], [8, "#2563eb"], [16, "#06b6d4"], [24, "#22c55e"], [32, "#eab308"], [42, "#dc2626"], [50, "#78120c"]],
  },
  precipitacion: {
    etiqueta: "Precipitación acumulada (24 h)",
    unidad: "mm",
    min: 0,
    max: 50,
    stops: [[0, "#e2e8f0"], [1, "#93c5fd"], [6, "#3b82f6"], [20, "#1d4ed8"], [50, "#0b2a73"]],
  },
};

function hexARgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function colorEscalaRgb(escala, valor) {
  const stops = escala.stops;
  const v = Math.min(escala.max, Math.max(escala.min, Number.isFinite(valor) ? valor : escala.min));
  for (let i = 1; i < stops.length; i += 1) {
    if (v <= stops[i][0]) {
      const [v0, c0] = stops[i - 1];
      const [v1, c1] = stops[i];
      const t = (v - v0) / (v1 - v0 || 1);
      const a = hexARgb(c0);
      const b = hexARgb(c1);
      return a.map((x, k) => Math.round(x + (b[k] - x) * t));
    }
  }
  return hexARgb(stops[stops.length - 1][1]);
}

export function colorEscala(escala, valor) {
  return `rgb(${colorEscalaRgb(escala, valor).join(",")})`;
}

export function gradienteCss(escala) {
  const rango = escala.max - escala.min;
  const partes = escala.stops.map(([v, c]) => `${c} ${Math.round(((v - escala.min) / rango) * 100)}%`);
  return `linear-gradient(90deg, ${partes.join(", ")})`;
}

/* --------------------- Interpolación y raster continuo ---------------------- */

export function interpolarValor(lat, lng, celdas, valorFn) {
  let num = 0;
  let den = 0;
  for (let i = 0; i < celdas.length; i += 1) {
    const c = celdas[i];
    const v = valorFn(c);
    if (!Number.isFinite(v)) continue;
    const d2 = (lat - c.lat) ** 2 + (lng - c.lng) ** 2;
    if (d2 < 1e-6) return v;
    const w = 1 / (d2 * Math.sqrt(d2));
    num += w * v;
    den += w;
  }
  return den > 0 ? num / den : null;
}

/**
 * Genera una imagen PNG con degradado continuo interpolado (IDW) y recortado a la frontera
 * de Bolivia en proyección Web Mercator, sin rectángulos ni números.
 */
export function generarImagenBolivia(celdas, valorFn, escala, ancho = 260, alto = 300) {
  const { west, south, east, north } = BBOX_BOLIVIA;
  const mNorth = mercatorY(north);
  const mSouth = mercatorY(south);
  const mSpan = mNorth - mSouth;
  const lngSpan = east - west;

  const crudo = document.createElement("canvas");
  crudo.width = ancho;
  crudo.height = alto;
  const ctxCrudo = crudo.getContext("2d");
  const img = ctxCrudo.createImageData(ancho, alto);
  const data = img.data;

  const lats = new Float64Array(alto);
  for (let py = 0; py < alto; py += 1) {
    lats[py] = invMercatorY(mNorth - (py / (alto - 1)) * mSpan);
  }
  const lngs = new Float64Array(ancho);
  for (let px = 0; px < ancho; px += 1) {
    lngs[px] = west + (px / (ancho - 1)) * lngSpan;
  }

  for (let py = 0; py < alto; py += 1) {
    const lat = lats[py];
    for (let px = 0; px < ancho; px += 1) {
      const lng = lngs[px];
      const idx = (py * ancho + px) * 4;
      const val = interpolarValor(lat, lng, celdas, valorFn);
      if (val == null) continue;
      const [r, g, b] = colorEscalaRgb(escala, val);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 215;
    }
  }
  ctxCrudo.putImageData(img, 0, 0);

  const salida = document.createElement("canvas");
  salida.width = ancho;
  salida.height = alto;
  const ctx = salida.getContext("2d");
  ctx.save();
  ctx.beginPath();
  FRONTERA.forEach(([lng, lat], i) => {
    const x = ((lng - west) / lngSpan) * (ancho - 1);
    const y = ((mNorth - mercatorY(lat)) / mSpan) * (alto - 1);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(crudo, 0, 0);
  ctx.restore();

  ctx.beginPath();
  FRONTERA.forEach(([lng, lat], i) => {
    const x = ((lng - west) / lngSpan) * (ancho - 1);
    const y = ((mNorth - mercatorY(lat)) / mSpan) * (alto - 1);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.strokeStyle = "rgba(15, 23, 42, 0.45)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  return {
    url: salida.toDataURL("image/png"),
    bounds: [[south, west], [north, east]],
  };
}
