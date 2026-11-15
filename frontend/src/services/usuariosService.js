import { api } from "../api/client";

export function listar() {
  return api("/usuarios");
}

export function crear(datos) {
  return api("/usuarios", { method: "POST", body: datos });
}

export function actualizar(idUsuario, datos) {
  return api(`/usuarios/${idUsuario}`, { method: "PATCH", body: datos });
}

export function cambiarEstado(idUsuario, estado) {
  return api(`/usuarios/${idUsuario}/estado`, { method: "PATCH", body: { estado } });
}
