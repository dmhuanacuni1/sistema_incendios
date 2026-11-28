import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { COLORES_RIESGO } from "../../pages/zonas/ZonasMapaGeneral";
import { CENTRO_BOLIVIA, ZOOM_BOLIVIA, centroide, puntosValidos } from "../../utils/geoBolivia";

const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Mapa para el registro de inspecciones de bombero. Muestra las zonas registradas y,
 * al seleccionar una en el formulario, hace zoom directamente sobre su polígono/punto.
 */
export default function MapaInspeccion({ zonas = [], idZonaSeleccionada = "", onSeleccionarZona }) {
  const contenedor = useRef(null);
  const mapaRef = useRef(null);
  const capaRef = useRef(null);
  const onSeleccionarRef = useRef(onSeleccionarZona);
  onSeleccionarRef.current = onSeleccionarZona;

  useEffect(() => {
    if (!contenedor.current || mapaRef.current) return undefined;
    const mapa = L.map(contenedor.current, { center: CENTRO_BOLIVIA, zoom: ZOOM_BOLIVIA });
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
    if (!mapa || !capa) return;
    capa.clearLayers();

    let zonaActivaPuntos = null;
    const idNum = Number(idZonaSeleccionada);

    zonas.forEach((z) => {
      const puntos = puntosValidos(z.coordenadas);
      if (!puntos.length) return;
      const seleccionada = z.id_zona === idNum;
      const color = COLORES_RIESGO[z.nivel_riesgo] || "#f97316";
      const centro = puntos.length >= 3 ? centroide(puntos) : puntos[0];

      if (seleccionada) zonaActivaPuntos = puntos;

      if (puntos.length >= 3) {
        L.polygon(puntos.map((p) => [p.lat, p.lng]), {
          color: seleccionada ? "#c2410c" : color,
          fillColor: color,
          fillOpacity: seleccionada ? 0.36 : 0.12,
          weight: seleccionada ? 2.5 : 1.2,
          dashArray: seleccionada ? undefined : "4 4",
        })
          .bindTooltip(`${esc(z.nombre)} · ${esc(z.nivel_riesgo)}`)
          .on("click", () => onSeleccionarRef.current?.(String(z.id_zona)))
          .addTo(capa);
      }

      if (seleccionada) {
        const icono = L.divIcon({
          className: "zr-vertice-wrapper",
          html: '<span class="zr-pin">📍</span>',
          iconSize: [28, 28],
          iconAnchor: [14, 26],
        });
        L.marker([centro.lat, centro.lng], { icon: icono })
          .bindTooltip(`${esc(z.nombre)} · ${esc(z.ubicacion)}`, { direction: "top", offset: [0, -22] })
          .addTo(capa);
      } else {
        L.circleMarker([centro.lat, centro.lng], {
          radius: 5,
          color: "#fff",
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.75,
        })
          .bindTooltip(`${esc(z.nombre)} · clic para inspeccionar`)
          .on("click", () => onSeleccionarRef.current?.(String(z.id_zona)))
          .addTo(capa);
      }
    });

    if (zonaActivaPuntos) {
      if (zonaActivaPuntos.length >= 3) {
        mapa.flyToBounds(zonaActivaPuntos.map((p) => [p.lat, p.lng]), { padding: [45, 45], maxZoom: 13, duration: 0.75 });
      } else {
        mapa.flyTo([zonaActivaPuntos[0].lat, zonaActivaPuntos[0].lng], 13, { duration: 0.75 });
      }
    } else {
      mapa.setView(CENTRO_BOLIVIA, ZOOM_BOLIVIA);
    }
  }, [zonas, idZonaSeleccionada]);

  return <div ref={contenedor} className="zr-insp-mapa" />;
}
