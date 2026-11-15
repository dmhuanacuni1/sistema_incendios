import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { limpiarSesion, guardarSesion, guardarUsuario, leerUsuario, accessTokenPorCaducar, refrescarAccessToken } from "../api/client";
import * as authService from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(leerUsuario);
  const [cargando, setCargando] = useState(
    () => !leerUsuario() && Boolean(localStorage.getItem("access_token") || localStorage.getItem("refresh_token"))
  );

  useEffect(() => {
    let activo = true;
    async function restaurar() {
      if (!localStorage.getItem("access_token") && localStorage.getItem("refresh_token")) {
        await refrescarAccessToken();
      }
      if (!localStorage.getItem("access_token")) {
        if (activo) setCargando(false);
        return;
      }
      try {
        const perfil = await authService.perfil();
        if (activo) setUsuario(perfil);
      } catch {
        limpiarSesion();
        if (activo) setUsuario(null);
      } finally {
        if (activo) setCargando(false);
      }
    }
    restaurar();
    return () => {
      activo = false;
    };
  }, []);

  const entrar = useCallback(async (credenciales) => {
    const data = await authService.login(credenciales);
    guardarSesion(data);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const registrar = useCallback(async (datos) => {
    const data = await authService.registro(datos);
    guardarSesion(data);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const cerrarSesion = useCallback(() => {
    limpiarSesion();
    setUsuario(null);
  }, []);

  useEffect(() => {
    if (usuario) guardarUsuario(usuario);
  }, [usuario]);

  const renovar = useCallback(async () => {
    if (!localStorage.getItem("refresh_token")) return;
    if (localStorage.getItem("access_token") && !accessTokenPorCaducar()) return;
    const ok = await refrescarAccessToken();
    if (!ok) {
      limpiarSesion();
      setUsuario(null);
    }
  }, []);

  const valor = useMemo(
    () => ({ usuario, cargando, entrar, registrar, cerrarSesion, renovar, setUsuario }),
    [usuario, cargando, entrar, registrar, cerrarSesion, renovar]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return contexto;
}
