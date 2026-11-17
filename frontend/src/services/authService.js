import { api, guardarSesion } from "../api/client";

export function login(credenciales) {
  return api("/auth/login", { method: "POST", body: credenciales, auth: false });
}

export function registro(datos) {
  return api("/auth/registro", { method: "POST", body: datos, auth: false });
}

export function recuperar(correo) {
  return api("/auth/recuperar", { method: "POST", body: { correo }, auth: false });
}

export function restablecer(datos) {
  return api("/auth/restablecer", { method: "POST", body: datos, auth: false });
}

export function perfil() {
  return api("/auth/me");
}

export async function cambiarContrasena(datos) {
  const sesion = await api("/auth/contrasena", { method: "POST", body: datos });
  guardarSesion(sesion);
  return sesion;
}
