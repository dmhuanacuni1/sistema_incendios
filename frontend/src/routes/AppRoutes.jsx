import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import InicioPage from "../pages/InicioPage";
import MarcoAcceso from "../components/layout/MarcoAcceso";
import CuentaPage from "../pages/usuarios/CuentaPage";
import LoginPage from "../pages/usuarios/LoginPage";
import RecuperarPage from "../pages/usuarios/RecuperarPage";
import RegistroPage from "../pages/usuarios/RegistroPage";
import RestablecerPage from "../pages/usuarios/RestablecerPage";
import UsuariosPage from "../pages/usuarios/UsuariosPage";

function PantallaCarga() {
  return <p className="cuenta estado-pantalla">Comprobando sesión…</p>;
}

function RutaPrivada({ children, soloAdmin = false }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PantallaCarga />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (soloAdmin && usuario.rol !== "ADMINISTRADOR") return <Navigate to="/cuenta" replace />;
  return children;
}

function RutaPublica({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PantallaCarga />;
  if (usuario) return <Navigate to="/cuenta" replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<InicioPage />} />
      <Route element={<RutaPublica><MarcoAcceso /></RutaPublica>}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/recuperar" element={<RecuperarPage />} />
      </Route>
      <Route element={<MarcoAcceso />}>
        <Route path="/restablecer/:token" element={<RestablecerPage />} />
      </Route>
      <Route path="/cuenta" element={<RutaPrivada><CuentaPage /></RutaPrivada>} />
      <Route path="/usuarios" element={<RutaPrivada soloAdmin><UsuariosPage /></RutaPrivada>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
