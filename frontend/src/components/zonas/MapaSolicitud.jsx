import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { COLORES_RIESGO } from "../../pages/zonas/ZonasMapaGeneral";
import { CENTRO_BOLIVIA, centroide, puntosValidos } from "../../utils/geoBolivia";

const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Muestra la ubicación o polígono de una solicitud ciudadana en el panel de evaluación.
 */
export default function MapaSolicitud({ solicitud, nivelRiesgo }) {
  const contenedor = useRef(null);
  const mapaRef = useRef(null);
  const capaRef = useRef(null);

  useEffect(() => {
    if (!contenedor.current || mapaRef.current) return undefined;
    const mapa = L.map(contenedor.current, { center: CENTRO_BOLIVIA, zoom: 6 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapa);
    capaRef.current = L.layerGroup().addTo(mapa);
    mapaRef.current = mapa;
    const t = setTimeout(() => mapa.invalidateSize(), 150);
    return () => {
      clearTimeout(t);
      mapa.remove();
      mapaRef.current = null;
      capaRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mapa = mapaRef.current;
    const capa = capaRef.current;
    if (!mapa || !capa || !solicitud) return;
    capa.clearLayers();

    let puntos = puntosValidos(solicitud.coordenadas);
    if (!puntos.length && solicitud.latitud != null && solicitud.longitud != null) {
      const lat = Number(solicitud.latitud);
      const lng = Number(solicitud.longitud);
      if (Number.isFinite(lat) && Number.isFinite(lng)) puntos = [{ lat, lng }];
    }
    if (!puntos.length) return;

    const color = COLORES_RIESGO[nivelRiesgo || solicitud.nivel_riesgo_sugerido] || "#f97316";
    const centro = puntos.length >= 3 ? centroide(puntos) : puntos[0];

    if (puntos.length >= 3) {
      L.polygon(puntos.map((p) => [p.lat, p.lng]), {
        color,
        fillColor: color,
        fillOpacity: 0.32,
        weight: 2.2,
      }).addTo(capa);
      mapa.fitBounds(puntos.map((p) => [p.lat, p.lng]), { padding: [45, 45], maxZoom: 15 });
    } else {
      L.circle([centro.lat, centro.lng], {
        radius: 500,
        color,
        fillColor: color,
        fillOpacity: 0.24,
        weight: 2,
      }).addTo(capa);
      mapa.setView([centro.lat, centro.lng], 14);
    }

    const icono = L.divIcon({
      className: "zr-vertice-wrapper",
      html: `<span class="zr-punto-exacto" style="border-color:${color}">📍</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 24],
    });
    L.marker([centro.lat, centro.lng], { icon: icono })
      .bindTooltip(`${esc(solicitud.nombre)} · ${esc(solicitud.ubicacion)}`, { direction: "top", offset: [0, -22] })
      .addTo(capa);
  }, [solicitud, nivelRiesgo]);

  return <div ref={contenedor} className="zr-sol-mapa" />;
}
