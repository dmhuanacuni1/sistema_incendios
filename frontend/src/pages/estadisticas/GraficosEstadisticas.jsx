const COLORES_ESTADO = {
  ACTIVO: "#963d3b",
  CONTROLADO: "#eab308",
  EXTINGUIDO: "#36805a",
  CERRADO: "#64748b",
};

const COLORES_GRAVEDAD = {
  BAJA: "#36805a",
  MEDIA: "#eab308",
  ALTA: "#e86a2a",
  CATASTROFICA: "#963d3b",
};

const COLORES_DANO = {
  LEVE: "#36805a",
  MODERADO: "#eab308",
  SEVERO: "#e86a2a",
  TOTAL: "#963d3b",
};

const ETIQUETAS = {
  ACTIVO: "Activo",
  CONTROLADO: "Controlado",
  EXTINGUIDO: "Extinguido",
  CERRADO: "Cerrado",
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  CATASTROFICA: "Catastrófica",
  LEVE: "Leve",
  MODERADO: "Moderado",
  SEVERO: "Severo",
  TOTAL: "Total",
};

function SinDatos() {
  return (
    <div className="est-grafico-vacio">
      No existen datos para representar.
    </div>
  );
}

// Grafico circular de distribucion por estado
function GraficoCircular({ datos, colores }) {
  const elementos = Object.entries(datos || {});

  const total = elementos.reduce(
    (suma, [, cantidad]) => suma + cantidad,
    0
  );

  if (!total) {
    return <SinDatos />;
  }

  let acumulado = 0;

  const segmentos = elementos
    .filter(([, cantidad]) => cantidad > 0)
    .map(([clave, cantidad]) => {
      const inicio = acumulado;
      const porcentaje = (cantidad / total) * 100;

      acumulado += porcentaje;

      return {
        clave,
        cantidad,
        porcentaje,
        inicio,
      };
    });

  return (
    <div className="est-circular-contenedor">

      <svg
        viewBox="0 0 160 160"
        className="est-grafico-circular"
        role="img"
        aria-label="Distribución de incidentes por estado"
      >
        <circle
          cx="80"
          cy="80"
          r="58"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="24"
        />

        {segmentos.map((segmento) => (
          <circle
            key={segmento.clave}
            cx="80"
            cy="80"
            r="58"
            fill="none"
            stroke={colores[segmento.clave] || "#64748b"}
            strokeWidth="24"
            pathLength="100"
            strokeDasharray={
              `${segmento.porcentaje} ${100 - segmento.porcentaje}`
            }
            strokeDashoffset={-segmento.inicio}
            transform="rotate(-90 80 80)"
          >
            <title>
              {ETIQUETAS[segmento.clave]}:
              {" "}{segmento.cantidad}
            </title>
          </circle>
        ))}

        <text
          x="80"
          y="77"
          textAnchor="middle"
          className="est-circular-total"
        >
          {total}
        </text>

        <text
          x="80"
          y="94"
          textAnchor="middle"
          className="est-circular-etiqueta"
        >
          Incidentes
        </text>
      </svg>

      <div className="est-leyenda">
        {elementos.map(([clave, cantidad]) => (
          <div
            className="est-leyenda-item"
            key={clave}
          >
            <span
              className="est-leyenda-color"
              style={{
                backgroundColor: colores[clave] || "#64748b",
              }}
            />

            <span>
              {ETIQUETAS[clave] || clave}
            </span>

            <strong>
              {cantidad} (
              {((cantidad / total) * 100).toFixed(1)}%)
            </strong>
          </div>
        ))}
      </div>

    </div>
  );
}

// Grafico de barras verticales reutilizable
function GraficoBarras({ datos, colores }) {
  const elementos = Object.entries(datos || {});

  const maximo = Math.max(
    0,
    ...elementos.map(([, cantidad]) => cantidad)
  );

  if (!maximo) {
    return <SinDatos />;
  }

  return (
    <div className="est-barras-verticales">

      {elementos.map(([clave, cantidad]) => (
        <div
          className="est-barra-columna"
          key={clave}
        >
          <div className="est-barra-area">

            <div
              className="est-barra-vertical"
              style={{
                height: `${(cantidad / maximo) * 100}%`,
                backgroundColor:
                  colores[clave] || "#64748b",
              }}
              title={`${ETIQUETAS[clave] || clave}: ${cantidad}`}
            >
              <span className="est-barra-valor">
                {cantidad}
              </span>
            </div>

          </div>

          <span className="est-barra-etiqueta">
            {ETIQUETAS[clave] || clave}
          </span>
        </div>
      ))}

    </div>
  );
}

// Frecuencia de incidentes por zona de riesgo
function GraficoZonas({ zonas }) {
  if (!zonas || zonas.length === 0) {
    return <SinDatos />;
  }

  const coloresRiesgo = {
    BAJO: "#36805a",
    MEDIO: "#eab308",
    ALTO: "#e86a2a",
    EXTREMO: "#963d3b",
  };

  return (
    <div className="est-zonas-lista">

      {zonas.map((zona) => (
        <div
          className="est-zona-item"
          key={zona.id_zona ?? "sin-zona"}
        >
          <div className="est-zona-cabecera">
            <strong>{zona.nombre}</strong>

            <span>
              {zona.cantidad} incidente(s)
            </span>
          </div>

          <div className="est-zona-pista">
            <div
              className="est-zona-barra"
              style={{
                width: `${zona.porcentaje}%`,
                backgroundColor:
                  coloresRiesgo[zona.nivel_riesgo] ||
                  "#64748b",
              }}
            />
          </div>

          <div className="est-zona-detalle">
            <span>
              Riesgo: {zona.nivel_riesgo || "Sin asignar"}
            </span>

            <strong>
              {Number(zona.porcentaje).toFixed(1)}%
            </strong>
          </div>
        </div>
      ))}

    </div>
  );
}

// Contenedor reutilizable para cada grafico
function PanelGrafico({
  titulo,
  descripcion,
  children,
  ancho = false,
}) {
  return (
    <article
      className={`est-panel est-panel-grafico ${
        ancho ? "est-panel-ancho" : ""
      }`}
    >
      <header className="est-panel-cabecera">
        <h3>{titulo}</h3>
        <p>{descripcion}</p>
      </header>

      {children}
    </article>
  );
}

// Componente principal de graficos
export default function GraficosEstadisticas({ datos }) {
  if (!datos) {
    return null;
  }

  return (
    <section className="est-graficos">

      <header className="est-seccion-cabecera">
        <h2>Análisis gráfico</h2>

        <p>
          Distribución y frecuencia de los incidentes
          registrados.
        </p>
      </header>

      <div className="est-graficos-rejilla">

        <PanelGrafico
          titulo="Incidentes por estado"
          descripcion="Distribución según el estado actual."
        >
          <GraficoCircular
            datos={datos.por_estado}
            colores={COLORES_ESTADO}
          />
        </PanelGrafico>

        <PanelGrafico
          titulo="Incidentes por gravedad"
          descripcion="Clasificación por nivel de gravedad."
        >
          <GraficoBarras
            datos={datos.por_gravedad}
            colores={COLORES_GRAVEDAD}
          />
        </PanelGrafico>

        <PanelGrafico
          titulo="Frecuencia de incidentes por zona"
          descripcion="Participación de cada zona en el total de incidentes."
          ancho
        >
          <GraficoZonas datos={undefined} zonas={datos.por_zona} />
        </PanelGrafico>

        <PanelGrafico
          titulo="Evaluaciones por nivel de daño"
          descripcion="Distribución de las evaluaciones registradas."
          ancho
        >
          <GraficoBarras
            datos={datos.danos?.por_nivel}
            colores={COLORES_DANO}
          />
        </PanelGrafico>

      </div>

    </section>
  );
}
