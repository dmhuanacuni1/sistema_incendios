import Icono from "../../components/layout/IconosVigia";

function TarjetaIndicador({
  titulo,
  valor,
  icono,
  tono = "normal",
  descripcion,
}) {
  return (
    <article className={`est-indicador est-indicador-${tono}`}>

      <div className="est-indicador-cabecera">
        <span className="est-indicador-icono">
          <Icono nombre={icono} tamano={22} />
        </span>

        <span className="est-indicador-titulo">
          {titulo}
        </span>
      </div>

      <strong className="est-indicador-valor">
        {valor}
      </strong>

      {descripcion && (
        <small className="est-indicador-descripcion">
          {descripcion}
        </small>
      )}

    </article>
  );
}

export default function IndicadoresEstadisticas({ datos }) {
  if (!datos) {
    return null;
  }

  const estados = datos.por_estado || {};
  const danos = datos.danos || {};

  const formatoNumero = new Intl.NumberFormat("es-BO", {
    maximumFractionDigits: 2,
  });

  const formatoMoneda = new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const tiempoCierre =
    datos.tiempo_promedio_cierre_horas == null
      ? "Sin datos"
      : `${formatoNumero.format(
          datos.tiempo_promedio_cierre_horas
        )} h`;

  const indicadores = [
    {
      titulo: "Total de incidentes",
      valor: datos.total_incidentes ?? 0,
      icono: "llama",
      tono: "fuego",
      descripcion: "Incidentes del período consultado",
    },
    {
      titulo: "Incidentes activos",
      valor: estados.ACTIVO ?? 0,
      icono: "alerta",
      tono: "critico",
      descripcion: "Incidentes en estado activo",
    },
    {
      titulo: "Incidentes controlados",
      valor: estados.CONTROLADO ?? 0,
      icono: "escudo",
      tono: "brasa",
      descripcion: "Incidentes bajo control",
    },
    {
      titulo: "Incidentes extinguidos",
      valor: estados.EXTINGUIDO ?? 0,
      icono: "check",
      tono: "normal",
      descripcion: "Incendios extinguidos",
    },
    {
      titulo: "Incidentes cerrados",
      valor: `${formatoNumero.format(
        datos.porcentaje_cerrados ?? 0
      )}%`,
      icono: "check",
      tono: "normal",
      descripcion: `${estados.CERRADO ?? 0} incidentes cerrados`,
    },
    {
      titulo: "Evaluaciones de daños",
      valor: danos.total_evaluaciones ?? 0,
      icono: "incidente",
      tono: "normal",
      descripcion: "Evaluaciones registradas",
    },
    {
      titulo: "Costo total estimado",
      valor: formatoMoneda.format(
        danos.costo_total_estimado ?? 0
      ),
      icono: "capas",
      tono: "brasa",
      descripcion: "Costo estimado de los daños",
    },
    {
      titulo: "Tiempo promedio de cierre",
      valor: tiempoCierre,
      icono: "incidente",
      tono: "normal",
      descripcion: "Desde el inicio hasta el cierre",
    },
  ];

  return (
    <section className="est-indicadores">

      <header className="est-seccion-cabecera">
        <h2>Indicadores estadísticos</h2>
        <p>
          Resumen de los incidentes registrados según
          los filtros seleccionados.
        </p>
      </header>

      <div className="est-indicadores-rejilla">
        {indicadores.map((indicador) => (
          <TarjetaIndicador
            key={indicador.titulo}
            {...indicador}
          />
        ))}
      </div>

    </section>
  );
}
