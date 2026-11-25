import { useEffect, useState } from "react";
import { listarZonas } from "../../services/zonasService";

const FILTROS_INICIALES = {
  fecha_inicio: "",
  fecha_fin: "",
  id_zona: "",
  nivel_riesgo: "",
};

export default function FiltrosEstadisticas({
  onAplicar,
  cargando = false,
  filtrosAplicados = {},
}) {
  const [filtros, setFiltros] = useState(() => ({
  ...FILTROS_INICIALES,
  ...filtrosAplicados,
}));

  const [zonas, setZonas] = useState([]);
  const [cargandoZonas, setCargandoZonas] = useState(true);
  const [errorZonas, setErrorZonas] = useState("");
  const [error, setError] = useState("");

  // Obtener el catalogo de zonas de riesgo
  useEffect(() => {
    let activo = true;

    async function cargarZonas() {
      try {
        const respuesta = await listarZonas();

        if (activo) {
          setZonas(respuesta.data || []);
        }
      } catch {
        if (activo) {
          setErrorZonas(
            "No se pudo cargar el catálogo de zonas"
          );
        }
      } finally {
        if (activo) {
          setCargandoZonas(false);
        }
      }
    }

    cargarZonas();

    return () => {
      activo = false;
    };
  }, []);

  // Actualizar los campos del formulario
  function cambiarFiltro(evento) {
    const { name, value } = evento.target;

    setFiltros((anteriores) => ({
      ...anteriores,
      [name]: value,
    }));

    setError("");
  }

  // Validar y aplicar los filtros
  function aplicarFiltros(evento) {
    evento.preventDefault();

    if (
      filtros.fecha_inicio &&
      filtros.fecha_fin &&
      filtros.fecha_inicio > filtros.fecha_fin
    ) {
      setError(
        "La fecha de inicio no puede ser mayor a la fecha final"
      );
      return;
    }

    setError("");
    onAplicar({ ...filtros });
  }

  // Restablecer los filtros
  function limpiarFiltros() {
    const nuevosFiltros = { ...FILTROS_INICIALES };

    setFiltros(nuevosFiltros);
    setError("");

    onAplicar(nuevosFiltros);
  }

  return (
    <section className="est-panel est-filtros">
      <header className="est-panel-cabecera">
        <h2>Filtros de consulta</h2>
        <p>
          Selecciona los criterios para consultar las
          estadísticas de incidentes.
        </p>
      </header>

      <form onSubmit={aplicarFiltros}>
        <div className="est-filtros-rejilla">

          <label className="est-campo">
            <span>Fecha de inicio</span>
            <input
              type="date"
              name="fecha_inicio"
              value={filtros.fecha_inicio}
              onChange={cambiarFiltro}
              disabled={cargando}
            />
          </label>

          <label className="est-campo">
            <span>Fecha de finalización</span>
            <input
              type="date"
              name="fecha_fin"
              value={filtros.fecha_fin}
              onChange={cambiarFiltro}
              disabled={cargando}
            />
          </label>

          <label className="est-campo">
            <span>Zona de riesgo</span>
            <select
              name="id_zona"
              value={filtros.id_zona}
              onChange={cambiarFiltro}
              disabled={
                cargando || cargandoZonas || !!errorZonas
              }
            >
              <option value="">
                {cargandoZonas
                  ? "Cargando zonas..."
                  : "Todas las zonas"}
              </option>

              {zonas.map((zona) => (
                <option
                  key={zona.id_zona}
                  value={zona.id_zona}
                >
                  {zona.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="est-campo">
            <span>Nivel de riesgo</span>
            <select
              name="nivel_riesgo"
              value={filtros.nivel_riesgo}
              onChange={cambiarFiltro}
              disabled={cargando}
            >
              <option value="">Todos los niveles</option>
              <option value="BAJO">Bajo</option>
              <option value="MEDIO">Medio</option>
              <option value="ALTO">Alto</option>
              <option value="EXTREMO">Extremo</option>
            </select>
          </label>

        </div>

        {errorZonas && (
          <p className="est-aviso" role="status">
            {errorZonas}
          </p>
        )}

        {error && (
          <p className="est-error" role="alert">
            {error}
          </p>
        )}

        <div className="est-filtros-acciones">
          <button
            type="button"
            className="vg-boton-secundario"
            onClick={limpiarFiltros}
            disabled={cargando}
          >
            Limpiar filtros
          </button>

          <button
            type="submit"
            className="est-boton-primario"
            disabled={cargando}
          >
            {cargando
              ? "Consultando..."
              : "Aplicar filtros"}
          </button>
        </div>
      </form>
    </section>
  );
}
