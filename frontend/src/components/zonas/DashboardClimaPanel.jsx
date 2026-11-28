import { ESCALAS, gradienteCss } from "../../services/climaService";

function construirSparkline(valores, ancho = 110, alto = 38) {
  if (!valores.length) return { linea: "", area: "" };
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;
  const pts = valores.map((v, i) => {
    const x = valores.length === 1 ? ancho / 2 : (i / (valores.length - 1)) * ancho;
    const y = alto - 4 - ((v - min) / rango) * (alto - 8);
    return [Number(x.toFixed(1)), Number(y.toFixed(1))];
  });
  const linea = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${linea} L${pts[pts.length - 1][0]},${alto} L${pts[0][0]},${alto} Z`;
  return { linea, area };
}

function ArcoHumedad({ porcentaje }) {
  const valor = Math.max(0, Math.min(100, Number.isFinite(porcentaje) ? porcentaje : 0));
  const radio = 36;
  const circunferencia = Math.PI * radio;
  const trazo = (valor / 100) * circunferencia;
  return (
    <svg viewBox="0 0 100 62" className="zr-gauge-svg" aria-hidden="true">
      <path d="M 14 50 A 36 36 0 0 1 86 50" fill="none" stroke="#e2e8f0" strokeWidth="9" strokeLinecap="round" />
      <path
        d="M 14 50 A 36 36 0 0 1 86 50"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${trazo} ${circunferencia}`}
      />
      <text x="50" y="45" textAnchor="middle" className="zr-gauge-val">{Math.round(valor)}%</text>
      <text x="50" y="57" textAnchor="middle" className="zr-gauge-lbl">Humedad</text>
      <text x="12" y="61" textAnchor="middle" className="zr-gauge-ext">0</text>
      <text x="88" y="61" textAnchor="middle" className="zr-gauge-ext">100</text>
    </svg>
  );
}

/**
 * Panel lateral derecho del Monitoreo Climático (estilo dashboard): promedio de temperatura
 * con sparkline, medidor semicircular de humedad, tendencia de viento, focos de calor y escala.
 */
export default function DashboardClimaPanel({
  zonas = [],
  climaZonas = {},
  opcionAnalisis,
  focos,
  onActualizarFocos,
  rejillaError,
  onReintentarRejilla,
}) {
  const temps = zonas.map((z) => Number(climaZonas[z.id_zona]?.temp ?? z.temperatura)).filter(Number.isFinite);
  const hums = zonas.map((z) => Number(climaZonas[z.id_zona]?.hum ?? z.humedad)).filter(Number.isFinite);
  const vientos = zonas.map((z) => Number(climaZonas[z.id_zona]?.viento ?? z.velocidad_viento)).filter(Number.isFinite);

  const promTemp = temps.length ? temps.reduce((s, v) => s + v, 0) / temps.length : null;
  const promHum = hums.length ? hums.reduce((s, v) => s + v, 0) / hums.length : 0;

  const sparkTemp = construirSparkline(temps.slice(0, 12));
  const sparkViento = construirSparkline(vientos.slice(0, 12), 116, 48);
  const escala = opcionAnalisis ? ESCALAS[opcionAnalisis.escala] : ESCALAS.temperatura;
  const tituloEscala = opcionAnalisis ? opcionAnalisis.etiqueta : "Temperatura (°C)";
  const resumenFocos = focos?.datos;

  return (
    <aside className="zr-clima-dash" aria-label="Dashboard del clima">
      <section className="zr-mg-tarjeta">
        <h4>Dashboard del Clima</h4>
        <div className="zr-dash-temp">
          <div>
            <span className="zr-dash-sub">Promedio de temperatura</span>
            <strong className="zr-dash-numero">
              {promTemp != null ? `${promTemp.toFixed(1)} °C` : "—"}
            </strong>
          </div>
          <svg viewBox="0 0 110 38" className="zr-spark-svg" aria-hidden="true">
            {sparkTemp.area && <path d={sparkTemp.area} fill="rgba(249, 115, 22, 0.22)" />}
            {sparkTemp.linea && <path d={sparkTemp.linea} fill="none" stroke="#ea580c" strokeWidth="2" />}
          </svg>
        </div>
      </section>

      <div className="zr-dash-doble">
        <section className="zr-mg-tarjeta zr-dash-mini">
          <ArcoHumedad porcentaje={promHum} />
        </section>
        <section className="zr-mg-tarjeta zr-dash-mini">
          <span className="zr-dash-sub">Tendencia del viento</span>
          <svg viewBox="0 0 116 48" className="zr-spark-svg" aria-hidden="true">
            {sparkViento.area && <path d={sparkViento.area} fill="rgba(59, 130, 246, 0.2)" />}
            {sparkViento.linea && <path d={sparkViento.linea} fill="none" stroke="#2563eb" strokeWidth="2" />}
          </svg>
          <span className="zr-dash-mini-pie">
            {vientos.length ? `Prom. ${Math.round(vientos.reduce((s, v) => s + v, 0) / vientos.length)} km/h` : "Sin datos"}
          </span>
        </section>
      </div>

      <section className="zr-mg-tarjeta">
        <h4>Focos de calor - últimas 24 h</h4>
        {focos?.estado === "error" && <p className="zr-error">{focos.error}</p>}
        {resumenFocos && resumenFocos.estado !== "ok" && (
          <p className="zr-ayuda-gps">{resumenFocos.mensaje || "Sin datos satelitales disponibles."}</p>
        )}
        {resumenFocos && resumenFocos.estado === "ok" && (
          <p className="zr-mg-total">Focos activos: <strong>{resumenFocos.total}</strong></p>
        )}
        <button
          type="button"
          className="zr-boton zr-secundario"
          disabled={focos?.estado === "cargando"}
          onClick={onActualizarFocos}
        >
          Actualizar focos
        </button>
      </section>

      <section className="zr-mg-tarjeta">
        <h4>{tituloEscala}</h4>
        {rejillaError && (
          <>
            <p className="zr-error">{rejillaError}</p>
            <button type="button" className="zr-boton zr-secundario" onClick={onReintentarRejilla}>Reintentar</button>
          </>
        )}
        <div className="zr-mg-gradiente" style={{ background: gradienteCss(escala) }} />
        <div className="zr-mg-gradiente-etiquetas">
          <span>{escala.extremos ? escala.extremos[0] : `${escala.min} ${escala.unidad}`}</span>
          <span>{escala.extremos ? escala.extremos[1] : `${escala.max}+ ${escala.unidad}`}</span>
        </div>
      </section>
    </aside>
  );
}
