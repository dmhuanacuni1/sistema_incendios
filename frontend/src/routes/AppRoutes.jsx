import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import MarcoAcceso from "../components/layout/MarcoAcceso";
import CuentaPage from "../pages/usuarios/CuentaPage";
import LoginPage from "../pages/usuarios/LoginPage";
import RecuperarPage from "../pages/usuarios/RecuperarPage";
import RegistroPage from "../pages/usuarios/RegistroPage";
import RestablecerPage from "../pages/usuarios/RestablecerPage";
import UsuariosPage from "../pages/usuarios/UsuariosPage";
import FrmRegEstacion from "../pages/recursos/frmRegEstacion";
import FrmRegUnidadRecurso from "../pages/recursos/frmRegUnidadRecurso";
import ConsultaRecursosPage from "../pages/recursos/ConsultaRecursosPage";
import RecursosEstacionesPage from "../pages/recursos/RecursosEstacionesPage";
import BrigadasPage from "../pages/brigadas/BrigadasPage";
import FrmRegBrigada from "../pages/brigadas/frmRegBrigada";
import FrmEditarBrigada from "../pages/brigadas/frmEditarBrigada";
import ConsultaBrigadasPage from "../pages/brigadas/ConsultaBrigadasPage";
import IncendiosAsignadosPage from "../pages/brigadas/IncendiosAsignadosPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import ZonasRiesgoPage from "../pages/zonas/ZonasRiesgoPage";
import { IncidentesPage } from "../pages/incidentes/IncidentesPage";
import HistorialAlertasPage from "../pages/alertas/HistorialAlertasPage";
import MisAlertasPage from "../pages/alertas/MisAlertasPage";

function PantallaCarga() {
  return <p className="cuenta estado-pantalla">Comprobando sesión…</p>;
}

const ROLES_OPERATIVOS = ["ADMINISTRADOR", "OPERADOR", "BOMBERO"];

function Inicio() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PantallaCarga />;
  return <Navigate to={usuario ? "/dashboard" : "/login"} replace />;
}

function RutaPrivada({ children, soloAdmin = false, roles = null }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PantallaCarga />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (soloAdmin && usuario.rol !== "ADMINISTRADOR") return <Navigate to="/dashboard" replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/dashboard" replace />;
  return children;
}

function RutaPublica({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PantallaCarga />;
  if (usuario) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route element={<RutaPublica><MarcoAcceso /></RutaPublica>}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/recuperar" element={<RecuperarPage />} />
      </Route>
      <Route element={<MarcoAcceso />}>
        <Route path="/restablecer/:token" element={<RestablecerPage />} />
      </Route>
      <Route path="/cuenta" element={<RutaPrivada><CuentaPage /></RutaPrivada>} />

      {/* Panel principal por rol: primero el incidente y la respuesta en campo. */}
      <Route path="/dashboard" element={<RutaPrivada><DashboardPage /></RutaPrivada>} />

      {/* Módulos activos: Recursos y Estaciones, Brigadas, Zonas de Riesgo, Incidentes y Usuarios. */}
      <Route
        path="/recursos"
        element={<RutaPrivada roles={ROLES_OPERATIVOS}><RecursosEstacionesPage /></RutaPrivada>}
      />
      <Route path="/recursos/estaciones/nueva" element={<RutaPrivada soloAdmin><FrmRegEstacion /></RutaPrivada>} />
      <Route path="/recursos/unidades/nueva" element={<RutaPrivada soloAdmin><FrmRegUnidadRecurso /></RutaPrivada>} />
      <Route path="/recursos/consultar" element={<RutaPrivada roles={ROLES_OPERATIVOS}><ConsultaRecursosPage /></RutaPrivada>} />

      {/* Iteración 3: Gestión de Brigadas. */}
      <Route path="/brigadas" element={<RutaPrivada roles={ROLES_OPERATIVOS}><BrigadasPage /></RutaPrivada>} />
      <Route path="/brigadas/nueva" element={<RutaPrivada soloAdmin><FrmRegBrigada /></RutaPrivada>} />
      <Route path="/brigadas/:idBrigada/editar" element={<RutaPrivada soloAdmin><FrmEditarBrigada /></RutaPrivada>} />
      <Route path="/brigadas/consultar" element={<RutaPrivada roles={ROLES_OPERATIVOS}><ConsultaBrigadasPage /></RutaPrivada>} />
      <Route path="/brigadas/incendios" element={<RutaPrivada roles={ROLES_OPERATIVOS}><IncendiosAsignadosPage /></RutaPrivada>} />

      {/* Iteración 4: Gestión de Zonas de Riesgo. */}
      <Route path="/zonas-riesgo" element={<RutaPrivada roles={[...ROLES_OPERATIVOS, "CIUDADANO"]}><ZonasRiesgoPage /></RutaPrivada>} />

      {/* Iteración 6: Gestión de Alertas y Notificaciones. */}
      <Route 
        path="/alertas" 
        element={
          <RutaPrivada roles={["ADMINISTRADOR", "OPERADOR"]}>
            <HistorialAlertasPage />
          </RutaPrivada>
        } 
      />
      <Route 
        path="/mis-alertas" 
        element={
          <RutaPrivada roles={["CIUDADANO"]}>
            <MisAlertasPage />
          </RutaPrivada>
        } 
      />

      <Route path="/usuarios" element={<RutaPrivada soloAdmin><UsuariosPage /></RutaPrivada>} />
      <Route path="/incidentes" element={<IncidentesPage />} />
      <Route path="/emergencia" element={<IncidentesPage />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
