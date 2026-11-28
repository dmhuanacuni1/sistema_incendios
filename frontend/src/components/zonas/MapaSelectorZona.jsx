import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import BuscadorMapa from "./BuscadorMapa";
import { ubicacionDePunto } from "../../services/climaService";
import { CENTRO_BOLIVIA, DEPARTAMENTOS, ZOOM_BOLIVIA, centroide, puntosValidos } from "../../utils/geoBolivia";

const redondear = (n) => Number(Number(n).toFixed(6));

/**
 * Mapa selector de zona.
 * - El buscador solo acerca/centra el mapa en la zona buscada, SIN marcar ningún punto.
 * - En modo "poligono" tiene dos pasos claros:
 *   1) Puntear ubicación exacta: el usuario hace zoom y marca el punto exacto (autocompleta calle/zona).
 *   2) Trazar polígono: agrega los vértices (3+) para delimitar el área.
 */
export default function MapaSelectorZona({
  puntos = [],
  onChange,
  onDireccionDetectada,
  modo = "poligono",
  color = "#f97316",
  altura = 520,
}) {
  const contenedor = useRef(null);
  const mapaRef = useRef(null);
  const capaRef = useRef(null);
  const exactoCapaRef = useRef(null);
  const basesRef = useRef({});
  const ajustadoRef = useRef(false);

  const puntosRef = useRef(puntos);
  const onChangeRef = useRef(onChange);
  const onDireccionRef = useRef(onDireccionDetectada);
  const modoRef = useRef(modo);
  const consultaDirRef = useRef(0);

  const [paso, setPaso] = useState(() => (puntosValidos(puntos).length >= 3 ? "poligono" : "exacto"));
  const [puntoExacto, setPuntoExacto] = useState(() => {
    const validos = puntosValidos(puntos);
    return validos.length === 1 ? validos[0] : null;
  });
  const pasoRef = useRef(paso);
  const puntoExactoRef = useRef(puntoExacto);

  const [busqueda, setBusqueda] = useState("");
  const [base, setBase] = useState("calle");
  const [ampliado, setAmpliado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [resolviendoDir, setResolviendoDir] = useState(false);

  puntosRef.current = puntos;
  onChangeRef.current = onChange;
  onDireccionRef.current = onDireccionDetectada;
  modoRef.current = modo;
  pasoRef.current = paso;
  puntoExactoRef.current = puntoExacto;

  // Si se limpia desde fuera (p. ej. al enviar formulario), resetear estado interno.
  useEffect(() => {
    const validos = puntosValidos(puntos);
    if (!validos.length) {
      setPuntoExacto(null);
      setPaso("exacto");
    }
  }, [puntos]);

  useEffect(() => {
    const t = setTimeout(() => mapaRef.current?.invalidateSize(), 120);
    return () => clearTimeout(t);
  }, [ampliado]);

  async function detectarDireccion(lat, lng) {
    if (!onDireccionRef.current) return;
    const id = ++consultaDirRef.current;
    setResolviendoDir(true);
    try {
      const info = await ubicacionDePunto(lat, lng);
      if (id === consultaDirRef.current) onDireccionRef.current(info);
    } catch {
      /* Si falla Nominatim, el usuario conserva lat/lng y puede editar la ubicación manualmente */
    } finally {
      if (id === consultaDirRef.current) setResolviendoDir(false);
    }
  }

  function clickEnMapa(lat, lng) {
    const punto = { lat: redondear(lat), lng: redondear(lng) };
    if (modoRef.current === "punto" || pasoRef.current === "exacto") {
      setPuntoExacto(punto);
      detectarDireccion(punto.lat, punto.lng);
      const actuales = puntosValidos(puntosRef.current);
      if (modoRef.current === "punto" || actuales.length <= 1) {
        onChangeRef.current?.([punto]);
      }
      return;
    }

    // Paso "poligono": agregar vértice; si no había punto exacto aún, usar el centroide al empezar.
    const actuales = puntosValidos(puntosRef.current);
    const baseVertices = actuales.length === 1 && puntoExactoRef.current &&
      actuales[0].lat === puntoExactoRef.current.lat && actuales[0].lng === puntoExactoRef.current.lng
      ? []
      : actuales;
    const nuevos = [...baseVertices, punto];
    onChangeRef.current?.(nuevos);
    if (!puntoExactoRef.current && nuevos.length === 1) {
      detectarDireccion(punto.lat, punto.lng);
    }
  }

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
    capaRef.current = L.layerGroup().addTo(mapa);
    exactoCapaRef.current = L.layerGroup().addTo(mapa);
    mapa.on("click", (e) => clickEnMapa(e.latlng.lat, e.latlng.lng));
    mapaRef.current = mapa;
    const t = setTimeout(() => mapa.invalidateSize(), 150);
    return () => {
      clearTimeout(t);
      mapa.remove();
      mapaRef.current = null;
      capaRef.current = null;
      exactoCapaRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    Object.entries(basesRef.current).forEach(([id, capa]) => {
      if (id === base) {
        if (!mapa.hasLayer(capa)) capa.addTo(mapa);
      } else if (mapa.hasLayer(capa)) {
        mapa.removeLayer(capa);
      }
    });
  }, [base]);

  // Dibujar vértices y polígono.
  useEffect(() => {
    const mapa = mapaRef.current;
    const capa = capaRef.current;
    if (!mapa || !capa) return;
    capa.clearLayers();
    const lista = puntosValidos(puntos);
    const esSoloExacto =
      modo === "poligono" &&
      lista.length === 1 &&
      puntoExacto &&
      lista[0].lat === puntoExacto.lat &&
      lista[0].lng === puntoExacto.lng;

    const vertices = esSoloExacto ? [] : lista;
    const latlngs = vertices.map((p) => [p.lat, p.lng]);

    if (modo === "poligono" && latlngs.length >= 3) {
      L.polygon(latlngs, { color, fillColor: color, fillOpacity: 0.25, weight: 2, interactive: false }).addTo(capa);
    } else if (modo === "poligono" && latlngs.length === 2) {
      L.polyline(latlngs, { color, weight: 2, dashArray: "6 4", interactive: false }).addTo(capa);
    }

    vertices.forEach((p, i) => {
      const icono = L.divIcon({
        className: "zr-vertice-wrapper",
        html: `<span class="zr-vertice" style="background:${color}">${modo === "punto" ? "●" : i + 1}</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      L.marker([p.lat, p.lng], { icon: icono, draggable: true, title: "Arrastra para mover" })
        .on("dragend", (e) => {
          const { lat, lng } = e.target.getLatLng();
          const copia = puntosValidos(puntosRef.current);
          copia[i] = { lat: redondear(lat), lng: redondear(lng) };
          onChangeRef.current?.(copia);
          if (modoRef.current === "punto") detectarDireccion(lat, lng);
        })
        .addTo(capa);
    });

    if (!ajustadoRef.current && lista.length) {
      ajustadoRef.current = true;
      if (lista.length === 1) mapa.setView([lista[0].lat, lista[0].lng], 15);
      else mapa.fitBounds(lista.map((p) => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 16 });
    }
  }, [puntos, puntoExacto, color, modo]);

  // Dibujar marcador del punto exacto fijado por el usuario (solo en modo polígono).
  useEffect(() => {
    const capa = exactoCapaRef.current;
    if (!capa) return;
    capa.clearLayers();
    if (modo !== "poligono" || !puntoExacto) return;
    const icono = L.divIcon({
      className: "zr-vertice-wrapper",
      html: `<span class="zr-punto-exacto" style="border-color:${color}">📍</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 24],
    });
    L.marker([puntoExacto.lat, puntoExacto.lng], { icon: icono, draggable: true, title: "Punto exacto (arrastra para ajustar)" })
      .on("dragend", (e) => {
        const { lat, lng } = e.target.getLatLng();
        const nuevo = { lat: redondear(lat), lng: redondear(lng) };
        setPuntoExacto(nuevo);
        detectarDireccion(nuevo.lat, nuevo.lng);
        const actuales = puntosValidos(puntosRef.current);
        if (actuales.length <= 1) onChangeRef.current?.([nuevo]);
      })
      .addTo(capa);
  }, [puntoExacto, modo, color]);

  function irA(lat, lng, bbox) {
    const mapa = mapaRef.current;
    if (!mapa) return;
    if (bbox && bbox.length === 4) {
      mapa.fitBounds([[bbox[0], bbox[2]], [bbox[1], bbox[3]]], { maxZoom: 17, padding: [20, 20] });
    } else {
      mapa.flyTo([lat, lng], 16, { duration: 0.8 });
    }
  }

  // Buscar SOLO acerca/centra el mapa; NO puntea nada automáticamente.
  function alSeleccionar(seleccion) {
    setAviso("");
    if (seleccion.tipo === "departamento") {
      const dep = DEPARTAMENTOS.find((d) => d.nombre === seleccion.departamento);
      if (dep) mapaRef.current?.flyTo(dep.centro, dep.zoom, { duration: 0.8 });
      setBusqueda(seleccion.departamento);
      return;
    }
    setBusqueda(seleccion.tipo === "zona" ? seleccion.zona.nombre : seleccion.nombre.split(",").slice(0, 2).join(","));
    irA(seleccion.lat, seleccion.lng, seleccion.bbox);
  }

  function usarMiUbicacion() {
    setAviso("");
    if (!navigator.geolocation) {
      setAviso("Este navegador no permite obtener la ubicación GPS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        irA(coords.latitude, coords.longitude);
        clickEnMapa(coords.latitude, coords.longitude);
      },
      () => setAviso("No se pudo obtener tu ubicación. Permite el acceso o márcala en el mapa."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  function deshacer() {
    const actuales = puntosValidos(puntos);
    if (paso === "exacto" || modo === "punto") {
      setPuntoExacto(null);
      if (actuales.length <= 1) onChangeRef.current?.([]);
      return;
    }
    if (actuales.length > 1) {
      onChangeRef.current?.(actuales.slice(0, -1));
    } else {
      onChangeRef.current?.(puntoExacto ? [puntoExacto] : []);
    }
  }

  function limpiarTodo() {
    setPuntoExacto(null);
    setPaso("exacto");
    onChangeRef.current?.([]);
  }

  const lista = puntosValidos(puntos);
  const verticesPoligono =
    lista.length === 1 && puntoExacto && lista[0].lat === puntoExacto.lat && lista[0].lng === puntoExacto.lng
      ? []
      : lista;

  const estado = resolviendoDir
    ? "Obteniendo calle y zona del punto marcado…"
    : modo === "punto"
      ? lista.length
        ? `Ubicación marcada: ${Number(lista[0].lat).toFixed(5)}, ${Number(lista[0].lng).toFixed(5)}`
        : "Acerca el mapa y haz clic para puntear la ubicación exacta."
      : paso === "exacto"
        ? puntoExacto
          ? `Punto exacto marcado (${puntoExacto.lat.toFixed(5)}, ${puntoExacto.lng.toFixed(5)}). Ahora puedes pasar a «2. Trazar polígono» o guardar así.`
          : "Acerca el mapa sobre el lugar y haz clic para puntear la ubicación exacta."
        : verticesPoligono.length < 3
          ? `Trazando polígono: ${verticesPoligono.length} vértice(s). Marca al menos 3 puntos alrededor del área.`
          : `Polígono con ${verticesPoligono.length} vértices. Arrastra cualquiera para ajustar el contorno.`;

  return (
    <div className={`zr-selector${ampliado ? " zr-selector-ampliado" : ""}`}>
      <div className="zr-selector-top">
        <BuscadorMapa
          valor={busqueda}
          onValorChange={setBusqueda}
          onSeleccionar={alSeleccionar}
          incluirZonas={false}
          placeholder="Buscar departamento, calle, barrio o lugar (solo acerca el mapa)…"
        />
        <button
          type="button"
          className="zr-boton zr-secundario"
          onClick={() => setAmpliado((v) => !v)}
          title={ampliado ? "Reducir mapa" : "Agrandar mapa"}
        >
          {ampliado ? "🗗 Reducir" : "⛶ Agrandar mapa"}
        </button>
      </div>

      {modo === "poligono" && (
        <div className="zr-pasos-mapa" role="group" aria-label="Pasos para marcar la zona">
          <button
            type="button"
            className={`zr-boton ${paso === "exacto" ? "zr-primario" : "zr-secundario"}`}
            onClick={() => setPaso("exacto")}
          >
            📍 1. Puntear ubicación exacta
          </button>
          <button
            type="button"
            className={`zr-boton ${paso === "poligono" ? "zr-primario" : "zr-secundario"}`}
            onClick={() => setPaso("poligono")}
          >
            ⬟ 2. Trazar polígono ({verticesPoligono.length})
          </button>
        </div>
      )}

      <div ref={contenedor} className="zr-selector-mapa" style={{ height: ampliado ? 640 : altura }} />

      <div className="zr-selector-acciones">
        <button type="button" className="zr-boton zr-secundario" disabled={!lista.length && !puntoExacto} onClick={deshacer}>
          ↶ Deshacer
        </button>
        <button type="button" className="zr-boton zr-secundario" disabled={!lista.length && !puntoExacto} onClick={limpiarTodo}>
          Limpiar
        </button>
        <button type="button" className="zr-boton zr-secundario" onClick={usarMiUbicacion}>
          📍 Mi ubicación
        </button>
        <select className="zr-selector-capa" value={base} onChange={(e) => setBase(e.target.value)} aria-label="Tipo de mapa">
          <option value="calle">Mapa</option>
          <option value="satelite">Satélite</option>
        </select>
      </div>
      <p className="zr-ayuda-gps">{aviso || estado}</p>
    </div>
  );
}
