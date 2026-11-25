import { api, apiBlob } from "../api/client";

export function listar() {
  return api("/estaciones");
}

export function foto(idEstacion) {
  return apiBlob(`/estaciones/${idEstacion}/foto`);
}

export function crear(datos) {
  return api("/estaciones", { method: "POST", body: datos });
}

export function actualizar(idEstacion, datos) {
  return api(`/estaciones/${idEstacion}`, { method: "PATCH", body: datos });
}

export function cambiarEstadoEstacion(idEstacion, estado, motivoBaja = "") {
  return api(`/estaciones/${idEstacion}`, {
    method: "PATCH",
    body: { estado, motivo_baja: motivoBaja },
  });
}

export function registrarUnidadRecurso(datos) {
  return api("/recursos", { method: "POST", body: datos });
}

export function consultar(estado = "") {
  const consulta = estado ? `?estado=${encodeURIComponent(estado)}` : "";
  return api(`/recursos/consultar${consulta}`);
}

export function cambiarEstado(tipo, id, estado, motivo) {
  return api(`/recursos/${tipo}/${id}/estado`, {
    method: "PATCH",
    body: { estado, motivo },
  });
}
