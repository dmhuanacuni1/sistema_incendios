import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icono from "./IconosVigia";
import { useOperacion } from "../../context/OperacionContext";
import { useVigia } from "../../context/VigiaContext";
import "../../styles/incidentes-nav.css";

const OPERATIVOS = ["ADMINISTRADOR", "OPERADOR", "BOMBERO"];

const ETIQUETA_ROL = {
  ADMINISTRADOR: "Administrador",
  OPERADOR: "Operador de central",
  BOMBERO: "Bombero",
  CIUDADANO: "Ciudadano",
};

const SUBMENU_INCIDENTES = [
  { id: "mapa_alertas", label: "Mapa y Alertas", icono: "ubicacion" },
  { id: "avisos", label: "Triage de Avisos", icono: "alerta", ocultarBombero: true },
  { id: "incidentes", label: "Gestión de Incidentes", icono: "incidente" },
  { id: "detalle", label: "Despacho e Informes", icono: "automovil" },
];

export default function VigiaSidebar({ usuario, pathname, onSalir }) {
  const { sidebarAbierto, setSidebarAbierto, colapsado, setColapsado } = useVigia();
  const { rolActivo, vistaIncidente, setVistaIncidente, navBadges } = useOperacion();
  const navigate = useNavigate();
  const rol = usuario?.rol;
  const nombre = usuario?.persona?.nombres || usuario?.nombre_usuario || "Operador";
  const inicial = nombre.trim().charAt(0).toUpperCase() || "V";
  const enDashboard = pathname === "/dashboard";
  const enRecursos = pathname.startsWith("/recursos");
  const enBrigadas = pathname.startsWith("/brigadas");
  const enZonas = pathname.startsWith("/zonas-riesgo");
  const enIncidentes =
    pathname.startsWith("/incidentes") || pathname.startsWith("/emergencia");
  const enUsuarios = pathname.startsWith("/usuarios");
  const esCiudadanoVista = rol === "CIUDADANO" || rolActivo === "CIUDADANO";
  const esBomberoVista = rol === "BOMBERO" || rolActivo === "BOMBERO";
  const enAlertas = pathname.startsWith("/alertas");
  const enMisAlertas = pathname.startsWith("/mis-alertas");
  const [incidentesAbierto, setIncidentesAbierto] = useState(enIncidentes);
  
  useEffect(() => {
    if (enIncidentes) {
      setIncidentesAbierto(true);
    }
  }, [enIncidentes]);

  const itemsSubmenuIncidentes = SUBMENU_INCIDENTES.filter(
    (item) => !(item.ocultarBombero && esBomberoVista)
  );

  function handleClickIncidentes() {
    if (!enIncidentes) {
      setIncidentesAbierto(true);
      navigate("/incidentes");
      if (colapsado) setSidebarAbierto(false);
      return;
    }
    if (colapsado) {
      setColapsado(false);
      setIncidentesAbierto(true);
      return;
    }
    setIncidentesAbierto((prev) => !prev);
  }

  function handleSeleccionarSubvista(idVista) {
    setVistaIncidente(idVista);
    if (!enIncidentes) {
      navigate("/incidentes");
    }
    setSidebarAbierto(false);
  }

  return (
    <>
      {sidebarAbierto && (
        <button
          type="button"
          className="vg-overlay"
          aria-label="Cerrar menú"
          onClick={() => setSidebarAbierto(false)}
        />
      )}

      <aside
        className={`vg-sidebar${sidebarAbierto ? " vg-sidebar-abierto" : ""}${
          colapsado ? " vg-sidebar-colapsado" : ""
        }`}
        aria-label="Navegación principal"
      >
        <div className="vg-sidebar-cabecera">
          <Link to="/dashboard" className="vg-marca" onClick={() => setSidebarAbierto(false)}>
            <span className="vg-marca-icono"><Icono nombre="llama" tamano={22} /></span>
            <span className="vg-marca-texto">
              <strong>Vigía Territorial</strong>
              <small>Prevención y respuesta</small>
            </span>
          </Link>
          <button
            type="button"
            className="vg-icono-boton vg-sidebar-cerrar"
            onClick={() => setSidebarAbierto(false)}
            aria-label="Cerrar menú"
          >
            <Icono nombre="cerrar" tamano={18} />
          </button>
        </div>

        <nav className="vg-nav" aria-label="Módulos del sistema">
          <p className="vg-nav-titulo">Módulos</p>
          <ul className="vg-nav-lista">
            <li>
              <Link
                to="/dashboard"
                className={`vg-nav-enlace${enDashboard ? " activo" : ""}`}
                onClick={() => setSidebarAbierto(false)}
                title={colapsado ? "Panel principal" : undefined}
                aria-current={enDashboard ? "page" : undefined}
              >
                <span className="vg-nav-numero">0</span>
                <Icono nombre="panelLateral" tamano={18} />
                <span className="vg-nav-texto">Panel principal</span>
              </Link>
            </li>
            {OPERATIVOS.includes(rol) && (
              <li>
                <Link
                  to="/recursos"
                  className={`vg-nav-enlace${enRecursos ? " activo" : ""}`}
                  onClick={() => setSidebarAbierto(false)}
                  title={colapsado ? "Recursos y Estaciones" : undefined}
                  aria-current={enRecursos ? "page" : undefined}
                >
                  <span className="vg-nav-numero">1</span>
                  <Icono nombre="estacion" tamano={18} />
                  <span className="vg-nav-texto">Recursos y Estaciones</span>
                </Link>
              </li>
            )}
            {OPERATIVOS.includes(rol) && (
              <li>
                <Link
                  to="/brigadas"
                  className={`vg-nav-enlace${enBrigadas ? " activo" : ""}`}
                  onClick={() => setSidebarAbierto(false)}
                  title={colapsado ? "Brigadas" : undefined}
                  aria-current={enBrigadas ? "page" : undefined}
                >
                  <span className="vg-nav-numero">2</span>
                  <Icono nombre="escudo" tamano={18} />
                  <span className="vg-nav-texto">Brigadas</span>
                </Link>
              </li>
            )}
            {(OPERATIVOS.includes(rol) || rol === "CIUDADANO") && (
              <li>
                <Link
                  to="/zonas-riesgo"
                  className={`vg-nav-enlace${enZonas ? " activo" : ""}`}
                  onClick={() => setSidebarAbierto(false)}
                  title={colapsado ? "Zonas de Riesgo" : undefined}
                  aria-current={enZonas ? "page" : undefined}
                >
                  <span className="vg-nav-numero">
                    {OPERATIVOS.includes(rol) ? "3" : "1"}
                  </span>
                  <Icono nombre="ubicacion" tamano={18} />
                  <span className="vg-nav-texto">Zonas de Riesgo</span>
                </Link>
              </li>
            )}
            <li>
              {esCiudadanoVista ? (
                <Link
                  to="/incidentes"
                  className={`vg-nav-enlace${enIncidentes ? " activo" : ""}`}
                  onClick={() => setSidebarAbierto(false)}
                  title={colapsado ? "Reportar Incendio" : undefined}
                  aria-current={enIncidentes ? "page" : undefined}
                >
                  <span className="vg-nav-numero">
                    {OPERATIVOS.includes(rol) ? "4" : "2"}
                  </span>
                  <Icono nombre="llama" tamano={18} />
                  <span className="vg-nav-texto">Reportar Incendio</span>
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    className={`vg-nav-enlace inc-nav-toggle${enIncidentes ? " activo" : ""}`}
                    onClick={handleClickIncidentes}
                    title={colapsado ? "Incidentes" : undefined}
                    aria-expanded={incidentesAbierto}
                  >
                    <span className="vg-nav-numero">
                      {OPERATIVOS.includes(rol) ? "4" : "2"}
                    </span>
                    <Icono nombre="llama" tamano={18} />
                    <span className="vg-nav-texto">Incidentes</span>
                    <span
                      className={`inc-nav-chevron${incidentesAbierto ? " abierto" : ""}`}
                      aria-hidden="true"
                    >
                      <Icono nombre="chevronDerecha" tamano={14} />
                    </span>
                  </button>

                  {incidentesAbierto && (
                    <ul className="inc-nav-submenu" aria-label="Vistas de Incidentes">
                      {itemsSubmenuIncidentes.map((item) => {
                        const activo = enIncidentes && vistaIncidente === item.id;
                        const badge = navBadges?.[item.id];
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              className={`inc-nav-subitem${activo ? " activo" : ""}`}
                              onClick={() => handleSeleccionarSubvista(item.id)}
                              aria-current={activo ? "page" : undefined}
                            >
                              <Icono nombre={item.icono} tamano={15} />
                              <span className="inc-nav-subtexto">{item.label}</span>
                              {badge != null && (
                                <span className="inc-nav-badge">{badge}</span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                </>

              )}
            </li>
            {(rol === "ADMINISTRADOR" || rol === "OPERADOR") && (
              <li>
                <Link
                  to="/alertas"
                  className={`vg-nav-enlace${enAlertas ? " activo" : ""}`}
                  onClick={() => setSidebarAbierto(false)}
                  title={colapsado ? "Alertas y Notificaciones" : undefined}
                  aria-current={enAlertas ? "page" : undefined}
                >
                  <span className="vg-nav-numero">5</span>
                  <Icono nombre="historial" tamano={18} />
                  <span className="vg-nav-texto">Alertas y Notificaciones</span>
                </Link>
              </li>
            )}
            {rol === "CIUDADANO" && (
              <li>
                <Link
                  to="/mis-alertas"
                  className={`vg-nav-enlace${enMisAlertas ? " activo" : ""}`}
                  onClick={() => setSidebarAbierto(false)}
                  title={colapsado ? "Mis Alertas" : undefined}
                  aria-current={enMisAlertas ? "page" : undefined}
                >
                  <span className="vg-nav-numero">3</span>
                  <Icono nombre="campana" tamano={18} />
                  <span className="vg-nav-texto">Mis Notificaciones</span>
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="vg-sidebar-pie">
          <button
            type="button"
            className="vg-colapsar"
            onClick={() => setColapsado(!colapsado)}
            aria-label={colapsado ? "Expandir menú" : "Contraer menú"}
          >
            <Icono nombre="panelLateral" tamano={18} />
            <span>Contraer menú</span>
          </button>

          {rol === "ADMINISTRADOR" && (
            <div className="vg-nav-grupo vg-nav-grupo-inferior">
              <p className="vg-nav-titulo">Cuenta</p>
              <ul className="vg-nav-lista">
                <li>
                  <Link
                    to="/usuarios"
                    className={`vg-nav-enlace${enUsuarios ? " activo" : ""}`}
                    onClick={() => setSidebarAbierto(false)}
                    title={colapsado ? "Usuarios" : undefined}
                    aria-current={enUsuarios ? "page" : undefined}
                  >
                    <span className="vg-nav-numero">5</span>
                    <Icono nombre="usuario" tamano={18} />
                    <span className="vg-nav-texto">Usuarios</span>
                  </Link>
                </li>
              </ul>
            </div>
          )}

          {usuario && (
            <div className="vg-perfil">
              <span className="vg-avatar">{inicial}</span>
              <span className="vg-perfil-datos">
                <strong>{nombre}</strong>
                <small>{ETIQUETA_ROL[rol] || rol || "Sesión activa"}</small>
              </span>
              <button
                type="button"
                className="vg-icono-boton vg-perfil-salir"
                onClick={onSalir}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <Icono nombre="salir" tamano={18} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
