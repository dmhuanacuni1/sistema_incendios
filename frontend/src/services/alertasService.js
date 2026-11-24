import { api } from "../api/client";

export async function obtenerMisAlertas() {
  const data = await api("/alertas/mis-alertas");
  return data.data || []; // Ajusta según la estructura de tu response_view
}

export async function confirmarAlerta(idAlerta) {
  return await api(`/alertas/${idAlerta}/confirmar`, { method: "PUT" });
}

export async function obtenerHistorial() {
  const data = await api("/alertas/historial");
  return data.data || [];
}