import { AuthProvider } from "./context/AuthContext";
import { useRefreshSesion } from "./hooks/useRefreshSesion";
import AppRoutes from "./routes/AppRoutes";

function RefrescoDeSesion() {
  useRefreshSesion();
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <RefrescoDeSesion />
      <AppRoutes />
    </AuthProvider>
  );
}
