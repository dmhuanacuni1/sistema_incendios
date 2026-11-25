import { api } from "../api/client";

/**
 * Consulta las estadisticas de incidentes.
 * Permite aplicar filtros opcionales.
 */
export async function consultarEstadisticas(filtros = {}) {
  const parametros = new URLSearchParams();

  if (filtros.fecha_inicio) {
    parametros.set("fecha_inicio", filtros.fecha_inicio);
  }

  if (filtros.fecha_fin) {
    parametros.set("fecha_fin", filtros.fecha_fin);
  }

  if (filtros.id_zona) {
    parametros.set("id_zona", filtros.id_zona);
  }

  if (filtros.nivel_riesgo) {
    parametros.set("nivel_riesgo", filtros.nivel_riesgo);
  }

  // Validacion preventiva de fechas
  if (
    filtros.fecha_inicio &&
    filtros.fecha_fin &&
    filtros.fecha_inicio > filtros.fecha_fin
  ) {
    throw new Error(
      "La fecha de inicio no puede ser mayor a la fecha final"
    );
  }

  const query = parametros.toString();

  const ruta = query
    ? `/estadisticas?${query}`
    : "/estadisticas";

  const respuesta = await api(ruta);

  return respuesta.data;
}
