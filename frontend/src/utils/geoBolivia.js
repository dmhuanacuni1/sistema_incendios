// Utilidades geográficas de Bolivia: departamentos, pertenencia al territorio y
// ayudas para trabajar con los puntos (lat/lng) de las zonas de riesgo.

export const DEPARTAMENTOS = [
  { nombre: "Beni", centro: [-14.0, -65.0], zoom: 7 },
  { nombre: "Chuquisaca", centro: [-20.3, -64.4], zoom: 8 },
  { nombre: "Cochabamba", centro: [-17.4, -65.8], zoom: 8 },
  { nombre: "La Paz", centro: [-15.4, -68.6], zoom: 7 },
  { nombre: "Oruro", centro: [-18.6, -67.5], zoom: 8 },
  { nombre: "Pando", centro: [-11.2, -67.9], zoom: 8 },
  { nombre: "Potosí", centro: [-20.6, -66.8], zoom: 7 },
  { nombre: "Santa Cruz", centro: [-17.4, -61.5], zoom: 7 },
  { nombre: "Tarija", centro: [-21.7, -64.1], zoom: 8 },
];

export const CENTRO_BOLIVIA = [-16.9, -64.6];
export const ZOOM_BOLIVIA = 6;
export const BBOX_BOLIVIA = { west: -69.65, south: -22.9, east: -57.45, north: -9.65 };

// Perímetro aproximado de Bolivia como [lng, lat] (mismo que usa el backend).
export const FRONTERA = [
  [-69.59, -10.95], [-68.67, -11.02], [-67.18, -10.32], [-66.65, -9.88],
  [-65.34, -9.68], [-65.3, -10.45], [-65.0, -11.9], [-64.2, -12.45],
  [-62.85, -12.9], [-62.1, -13.3], [-60.38, -13.62], [-60.2, -15.05],
  [-58.4, -16.28], [-57.62, -17.55], [-57.46, -18.15], [-57.65, -19.05],
  [-58.17, -20.17], [-59.95, -19.32], [-61.75, -19.62], [-62.26, -20.48],
  [-62.27, -22.25], [-62.65, -22.25], [-63.98, -22.02], [-64.25, -22.86],
  [-64.6, -22.85], [-64.96, -22.12], [-65.2, -22.1], [-66.22, -21.78],
  [-67.15, -22.88], [-67.88, -22.82], [-68.52, -21.25], [-68.45, -19.45],
  [-69.1, -18.35], [-69.62, -17.5], [-69.08, -16.22], [-69.38, -15.25],
  [-68.88, -14.2], [-68.67, -12.5], [-69.55, -11.9],
];

export function mercatorY(lat) {
  const rad = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

export function invMercatorY(y) {
  return ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
}

export function puntoEnBolivia(lat, lng) {
  let dentro = false;
  for (let i = 0, j = FRONTERA.length - 1; i < FRONTERA.length; j = i++) {
    const [xi, yi] = FRONTERA[i];
    const [xj, yj] = FRONTERA[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function puntosValidos(coordenadas) {
  return (Array.isArray(coordenadas) ? coordenadas : [])
    .map((p) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

export function centroide(puntos) {
  const lista = puntosValidos(puntos);
  if (!lista.length) return null;
  return {
    lat: lista.reduce((s, p) => s + p.lat, 0) / lista.length,
    lng: lista.reduce((s, p) => s + p.lng, 0) / lista.length,
  };
}

// Misma estimación por rectángulos que el backend para ubicar un punto en un departamento.
export function estimarDepartamento(lat, lng) {
  if (lat >= -12.5 && lng <= -66.2) return "Pando";
  if (lat >= -15.85 && lng >= -67.55 && lng <= -63.2) return "Beni";
  if (lat >= -17.65 && lng <= -66.95) return "La Paz";
  if (lat >= -18.55 && lat <= -15.85 && lng >= -66.95 && lng <= -64.3) return "Cochabamba";
  if (lat >= -19.8 && lat < -17.65 && lng <= -66.5) return "Oruro";
  if (lat < -20.95 && lng >= -65.4 && lng <= -62.2) return "Tarija";
  if (lat >= -20.95 && lat <= -18.55 && lng >= -65.65 && lng <= -63.65) return "Chuquisaca";
  if (lng >= -64.3 && lat >= -20.55) return "Santa Cruz";
  return lng < -64.5 ? "Potosí" : "Santa Cruz";
}

// Departamento de una zona: primero por el texto de la ubicación (…, Departamento) y,
// si no aparece, por sus coordenadas.
export function departamentoDeZona(zona) {
  const segmentos = String(zona?.ubicacion || "").split(",").map(normalizar).reverse();
  segmentos.push(normalizar(zona?.nombre));
  for (const segmento of segmentos) {
    const hallado = DEPARTAMENTOS.find((d) => segmento.includes(normalizar(d.nombre)));
    if (hallado) return hallado.nombre;
  }
  const c = centroide(zona?.coordenadas);
  return c ? estimarDepartamento(c.lat, c.lng) : null;
}

export function textoBusquedaZona(zona) {
  return normalizar(
    [zona?.nombre, zona?.ubicacion, zona?.descripcion, zona?.tipo_vegetacion, zona?.nivel_riesgo, departamentoDeZona(zona)]
      .filter(Boolean)
      .join(" ")
  );
}
