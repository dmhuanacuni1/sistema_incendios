import { useNavigate } from "react-router-dom";
import Icono from "./IconosVigia";
import { useVigia } from "../../context/VigiaContext";
import NotificationBell from "./NotificationBell";

const TITULOS = [
  ["/dashboard", "Panel principal"],
  ["/recursos/estaciones/nueva", "Nueva Estación"],
  ["/recursos/unidades/nueva", "Nueva Unidad o Recurso"],
  ["/recursos/consultar", "Consulta detallada"],
  ["/recursos", "Recursos y Estaciones"],
  ["/brigadas/nueva", "Nueva Brigada"],
  ["/brigadas/consultar", "Consulta de Brigadas"],
  ["/brigadas/incendios", "Incendios Asignados"],
  ["/brigadas", "Gestión de Brigadas"],
  ["/incidentes", "Incidentes y Emergencias"],
  ["/emergencia", "Emergencias SOS"],
  ["/usuarios", "Usuarios"],
  ["/cuenta", "Mi cuenta"],
];

function tituloDe(pathname) {
  const coincidencias = TITULOS.filter(([ruta]) => pathname.startsWith(ruta)).sort(
    (a, b) => b[0].length - a[0].length
  );
  return coincidencias[0]?.[1] || "Vigía Territorial";
}

export default function VigiaHeader({ pathname, usuario }) {
  const { busqueda, setBusqueda, setSidebarAbierto } = useVigia();
  const navigate = useNavigate();
  const esAdmin = usuario?.rol === "ADMINISTRADOR";
  const enRecursos = pathname.startsWith("/recursos");
  const enBrigadas = pathname.startsWith("/brigadas");

  return (
    <header className="vg-header">
      <div className="vg-header-izquierda">
        <button
          type="button"
          className="vg-icono-boton vg-hamburguesa"
          onClick={() => setSidebarAbierto(true)}
          aria-label="Abrir menú"
        >
          <Icono nombre="menu" tamano={21} />
        </button>
        <div className="vg-migas">
          <small>Vigía Territorial</small>
          <h1>{tituloDe(pathname)}</h1>
        </div>
      </div>

      <div className="vg-header-derecha">
        <NotificationBell />
        {enRecursos && (
          <label className="vg-buscar">
            <Icono nombre="buscar" tamano={18} />
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar estaciones, unidades o recursos…"
              aria-label="Buscar estaciones"
            />
            {busqueda && (
              <button
                type="button"
                className="vg-buscar-limpiar"
                onClick={() => setBusqueda("")}
                aria-label="Limpiar búsqueda"
              >
                <Icono nombre="cerrar" tamano={15} />
              </button>
            )}
          </label>
        )}

        {enRecursos && esAdmin && (
          <div className="vg-header-acciones">
            <button
              type="button"
              className="vg-boton-secundario"
              onClick={() => navigate("/recursos/unidades/nueva")}
            >
              <Icono nombre="capas" tamano={18} />
              <span>Unidad o Recurso</span>
            </button>
            <button
              type="button"
              className="vg-boton-principal"
              onClick={() => navigate("/recursos/estaciones/nueva")}
            >
              <Icono nombre="mas" tamano={18} />
              <span>Nueva Estación</span>
            </button>
          </div>
        )}

        {enBrigadas && esAdmin && (
          <div className="vg-header-acciones">
            <button
              type="button"
              className="vg-boton-principal"
              onClick={() => navigate("/brigadas/nueva")}
            >
              <Icono nombre="mas" tamano={18} />
              <span>Nueva Brigada</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
