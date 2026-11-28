
import { api } from "../api/client";

export function listarZonas() {
  return api("/zonas-riesgo");
}

export function modificarZona(idZona, datos) {
  return api(`/zonas-riesgo/${idZona}`, {
    method: "PUT",
    body: datos,
  });
}

export function eliminarZona(idZona) {
  return api(`/zonas-riesgo/${idZona}`, { method: "DELETE" });
}

export function cambiarEstadoZona(idZona, estado, motivo) {
  return api(`/zonas-riesgo/${idZona}/estado`, {
    method: "PATCH",
    body: { estado, motivo },
  });
}

export function consultarHistorialZona(idZona) {
  return api(`/zonas-riesgo/${idZona}/historial`);
}

export function crearZona(datos) {
  return api("/zonas-riesgo", { method: "POST", body: datos });
}

export function resolverUbicacion(ubicacion) {
  return api("/zonas-riesgo/resolver-ubicacion", { method: "POST", body: { ubicacion } });
}

export function crearSolicitudZona(datos) {
  return api("/solicitudes-zonas", { method: "POST", body: datos });
}

export function listarSolicitudesMias() {
  return api("/solicitudes-zonas/mias");
}

export function listarSolicitudesPendientes() {
  return api("/solicitudes-zonas/pendientes");
}

export function listarTodasSolicitudes(estado = "") {
  return api(`/solicitudes-zonas${estado ? `?estado=${encodeURIComponent(estado)}` : ""}`);
}

export function evaluarSolicitud(id, estado, observacion, nivel_riesgo_final) {
  return api(`/solicitudes-zonas/${id}/evaluacion`, {
    method: "PATCH",
    body: { estado, observacion, nivel_riesgo_final },
  });
}

export function eliminarSolicitud(id) {
  return api(`/solicitudes-zonas/${id}`, { method: "DELETE" });
}

export function registrarInspeccion(datos) {
  return api("/inspecciones", { method: "POST", body: datos });
}

export function listarInspecciones(idZona) {
  return api(`/inspecciones/zona/${idZona}`);
}

export function listarTodasInspecciones() {
  return api("/inspecciones");
}

export function emitirAlertaZona(idZona, datos) {
  return api(`/zonas-riesgo/${idZona}/alerta`, { method: "POST", body: datos });
}

export function listarFocosSatelitales(dias = 1, refrescar = false) {
  return api(`/zonas-riesgo/focos-satelitales?days=${dias}${refrescar ? "&refresh=1" : ""}`);
}

export function listarAreasQuemadas() {
  return api("/zonas-riesgo/areas-quemadas");
}
