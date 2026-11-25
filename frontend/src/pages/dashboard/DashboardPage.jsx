import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import Icono from "../../components/layout/IconosVigia";
import { useAuth } from "../../hooks/useAuth";
import { usePolling } from "../../hooks/usePolling";
import { useOperacion } from "../../context/OperacionContext";
import { avisosService, incidentesService } from "../../services/incidentesService";
import * as brigadasService from "../../services/brigadasService";
import { listarZonas } from "../../services/zonasService";
import "../../styles/dashboard.css";

const ESTADOS_INCIDENTE = {
  ACTIVO: { etiqueta: "Activo", clase: "critico" },
  CONTROLADO: { etiqueta: "Controlado", clase: "brasa" },
  EXTINGUIDO: { etiqueta: "Extinguido", clase: "normal" },
  CERRADO: { etiqueta: "Cerrado", clase: "normal" },
};

const GRAVEDADES = {
  BAJA: { etiqueta: "Gravedad baja", clase: "normal" },
  MEDIA: { etiqueta: "Gravedad media", clase: "brasa" },
  ALTA: { etiqueta: "Gravedad alta", clase: "critico" },
  CATASTROFICA: { etiqueta: "Catastófica", clase: "critico" },
};

const ETIQUETA_ROL = {
  ADMINISTRADOR: "Administrador · vista completa",
  OPERADOR: "Operador de central · vista operativa",
  BOMBERO: "Bombero · vista de brigada",
  CIUDADANO: "Ciudadano · información pública",
};

const ETIQUETA_EVENTO = {
  AVISO_RECIBIDO: "Aviso",
  INCIDENTE_APERTURADO: "Apertura",
  BRIGADA_ASIGNADA: "Despacho",
  INFORME_BOMBERO: "Informe en campo",
  EVALUACION_DANOS: "Evaluación",
  INCIDENTE_CERRADO: "Cierre",
};

function enEsteMes(iso) {
  if (!iso) return false;
  const fecha = new Date(iso);
  const hoy = new Date();
  return (
    !Number.isNaN(fecha.getTime()) &&
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth()
  );
}

function fechaLegible(iso, conHora = true) {
  if (!iso) return "Fecha sin registrar";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "Fecha sin registrar";
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(fecha);
}

function duracionLegible(minutos) {
  if (minutos === null || minutos === undefined) return "En curso";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

function coordsDe(registro) {
  const coords = registro?.coordenadas;
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return null;
  return coords;
}

function sinCosto(detalle) {
  return String(detalle || "").replace(/\s*·\s*Costo estimado:\s*[^·]+$/, "");
}

function EstadoChip({ valor, gravedad = false }) {
  const mapa = gravedad ? GRAVEDADES : ESTADOS_INCIDENTE;
  const info = mapa[valor] || { etiqueta: valor || "Sin dato", clase: "normal" };
  return <span className={`dash-chip dash-chip-${info.clase}`}>{info.etiqueta}</span>;
}

function Kpi({ icono, valor, etiqueta, tono = "normal" }) {
  return (
    <div className={`dash-kpi dash-kpi-${tono}`}>
      <span className="dash-kpi-icono"><Icono nombre={icono} tamano={20} /></span>
      <span className="dash-kpi-texto">
        <strong>{valor}</strong>
        <small>{etiqueta}</small>
      </span>
    </div>
  );
}

function Seccion({ titulo, descripcion, children, clase = "" }) {
  return (
    <section className={`dash-seccion ${clase}`}>
      <header className="dash-seccion-cabecera">
        <h2>{titulo}</h2>
        {descripcion && <p>{descripcion}</p>}
      </header>
      {children}
    </section>
  );
}

function EventoTimeline({ evento, mostrarCosto }) {
  const detalle =
    mostrarCosto || evento.tipo !== "EVALUACION_DANOS"
      ? evento.detalle
      : sinCosto(evento.detalle);
  return (
    <li className={`dash-evento dash-evento-${evento.tipo.toLowerCase()}`}>
      <span className="dash-evento-punto" />
      <div className="dash-evento-cuerpo">
        <div className="dash-evento-cabecera">
          <strong>{evento.titulo}</strong>
          <small>{fechaLegible(evento.timestamp)}</small>
        </div>
        <span className="dash-evento-tipo">{ETIQUETA_EVENTO[evento.tipo] || evento.tipo}</span>
        {detalle && <p>{detalle}</p>}
      </div>
    </li>
  );
}

function BrigadaCard({ brigada }) {
  const estado =
    brigada.estado_asignacion === "LIBERADA"
      ? { etiqueta: "Liberada", clase: "normal" }
      : { etiqueta: brigada.estado_asignacion || "Asignada", clase: "brasa" };
  return (
    <article className="dash-tarjeta-mini">
      <div className="dash-mini-cabecera">
        <span className="dash-mini-icono"><Icono nombre="escudo" tamano={19} /></span>
        <div>
          <h3>{brigada.nombre_brigada || `Brigada #${brigada.id_brigada}`}</h3>
          <p>{brigada.estacion_nombre || "Estación sin registrar"}</p>
        </div>
        <span className={`dash-chip dash-chip-${estado.clase}`}>{estado.etiqueta}</span>
      </div>
      <dl className="dash-mini-datos">
        <div><dt>Jefe de cuadrilla</dt><dd>{brigada.jefe_cuadrilla || "Sin registrar"}</dd></div>
        <div><dt>Bomberos</dt><dd>{brigada.cantidad_miembros ?? "—"}</dd></div>
        <div><dt>Despacho</dt><dd>{fechaLegible(brigada.fecha_asignacion)}</dd></div>
      </dl>
    </article>
  );
}

function InformeCard({ informe }) {
  return (
    <article className="dash-tarjeta-mini">
      <div className="dash-mini-cabecera">
        <span className="dash-mini-icono"><Icono nombre="usuario" tamano={19} /></span>
        <div>
          <h3>{informe.nombre_bombero || `Bombero #${informe.id_bombero}`}</h3>
          <p>{fechaLegible(informe.fecha_hora)}</p>
        </div>
      </div>
      <p className="dash-mini-texto">{informe.acciones}</p>
      {informe.observaciones && (
        <p className="dash-mini-observacion">Observaciones: {informe.observaciones}</p>
      )}
    </article>
  );
}

function AvisoCard({ aviso }) {
  const pendiente = aviso.estado_aviso === "PENDIENTE";
  return (
    <li className="dash-lista-item">
      <span className={`dash-lista-icono${pendiente ? " urgente" : ""}`}>
        <Icono nombre="alerta" tamano={17} />
      </span>
      <div>
        <strong>{aviso.ubicacion || "Ubicación sin registrar"}</strong>
        <small>
          #{aviso.id_aviso} · {fechaLegible(aviso.fecha_hora)} · {aviso.estado_aviso}
          {aviso.alerta_sla ? " · Fuera de SLA" : ""}
        </small>
      </div>
    </li>
  );
}

function ZonaCard({ zona }) {
  const riesgo = zona.nivel_riesgo || "—";
  return (
    <li className="dash-lista-item">
      <span className={`dash-lista-icono${riesgo === "EXTREMO" || riesgo === "ALTO" ? " urgente" : ""}`}>
        <Icono nombre="ubicacion" tamano={17} />
      </span>
      <div>
        <strong>{zona.nombre || `Zona #${zona.id_zona}`}</strong>
        <small>{riesgo} · {zona.estado || "Estado sin registrar"}</small>
      </div>
    </li>
  );
}

export default function DashboardPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const { setVistaIncidente } = useOperacion();
  const [refresco, setRefresco] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [datos, setDatos] = useState({});

  const rol = usuario?.rol;
  const esAdmin = rol === "ADMINISTRADOR";
  const esOperador = rol === "OPERADOR";
  const esBombero = rol === "BOMBERO";
  const esCiudadano = rol === "CIUDADANO";
  const idPersona = usuario?.persona?.id_persona;

  // El ciudadano puede reportar desde otro tab o desde el portal; sin este
  // refresco el KPI "Mis avisos" se queda con el valor que tenía al entrar.
  usePolling(
    () => {
      if (!esCiudadano) return;
      avisosService
        .mios()
        .then((r) => setDatos((prev) => ({ ...prev, avisos: r.data || [] })))
        .catch(() => {});
    },
    8000,
    esCiudadano
  );

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError("");

    async function cargar() {
      try {
        if (esAdmin || esOperador) {
          const [resumen, incidentes, avisos, zonas] = await Promise.all([
            incidentesService.resumenOperativo().then((r) => r.data).catch(() => null),
            incidentesService.listar({}).then((r) => r.data || []).catch(() => []),
            avisosService.listar({}).then((r) => r.data || []).catch(() => []),
            listarZonas().then((r) => r.data || []).catch(() => []),
          ]);
          const ordenados = [...incidentes].sort(
            (a, b) =>
              new Date(b.fecha_inicio || b.created_at || 0) -
              new Date(a.fecha_inicio || a.created_at || 0)
          );
          const activo = ordenados.find((i) => i.estado !== "CERRADO") || null;
          const seleccionado = activo || ordenados[0] || null;
          const expediente = seleccionado
            ? await incidentesService
                .expediente(seleccionado.id_incidente)
                .then((r) => r.data)
                .catch(() => null)
            : null;
          if (vivo) {
            setDatos({
              resumen,
              incidentes: ordenados,
              activo,
              seleccionado,
              expediente,
              avisos: avisos
                .filter((a) => ["PENDIENTE", "VERIFICADO"].includes(a.estado_aviso))
                .slice(0, 4),
              zonas,
            });
          }
        } else if (esBombero) {
          const [asignaciones, misBrigadas] = await Promise.all([
            brigadasService.incendiosAsignados().catch(() => []),
            brigadasService.misBrigadas().catch(() => []),
          ]);
          const ordenadas = [...asignaciones].sort(
            (a, b) =>
              new Date(b.fecha_inicio || b.fecha_asignacion || 0) -
              new Date(a.fecha_inicio || a.fecha_asignacion || 0)
          );
          const activa =
            ordenadas.find(
              (a) =>
                a.estado_incidente &&
                a.estado_incidente !== "CERRADO" &&
                a.estado_asignacion !== "LIBERADA"
            ) || ordenadas[0] || null;
          const expediente = activa
            ? await incidentesService
                .expediente(activa.id_incidente)
                .then((r) => r.data)
                .catch(() => null)
            : null;
          if (vivo) setDatos({ asignaciones: ordenadas, misBrigadas, activa, expediente });
        } else if (esCiudadano) {
          const [avisos, zonas] = await Promise.all([
            avisosService.mios().then((r) => r.data || []).catch(() => []),
            listarZonas().then((r) => r.data || []).catch(() => []),
          ]);
          if (vivo) setDatos({ avisos, zonas });
        }
      } catch (err) {
        if (vivo) setError(err?.message || "No se pudo cargar el panel");
      } finally {
        if (vivo) setCargando(false);
      }
    }

    cargar();
    return () => {
      vivo = false;
    };
  }, [esAdmin, esOperador, esBombero, esCiudadano, refresco]);

  const incidente = useMemo(() => {
    if (datos.expediente?.incidente) return datos.expediente.incidente;
    if (datos.seleccionado) return datos.seleccionado;
    if (datos.activa) {
      return {
        id_incidente: datos.activa.id_incidente,
        ubicacion: datos.activa.ubicacion,
        gravedad: datos.activa.gravedad,
        estado: datos.activa.estado_incidente || "ACTIVO",
        fecha_inicio: datos.activa.fecha_inicio,
        coordenadas: null,
      };
    }
    return null;
  }, [datos.expediente, datos.seleccionado, datos.activa]);

  const kpis = useMemo(() => {
    if (esAdmin || esOperador) {
      const incidentes = datos.incidentes || [];
      const resumen = datos.resumen || {};
      const activos = incidentes.filter((i) => i.estado !== "CERRADO").length;
      const esteMes = incidentes.filter((i) => enEsteMes(i.fecha_inicio)).length;
      const pendientes = resumen.avisos_por_estado?.PENDIENTE ?? 0;
      const lista = [
        { icono: "llama", valor: esteMes, etiqueta: "Incendios en el mes", tono: "fuego" },
        { icono: "incidente", valor: activos, etiqueta: "Incidentes activos", tono: activos ? "critico" : "normal" },
        { icono: "alerta", valor: pendientes, etiqueta: "Avisos pendientes", tono: pendientes ? "brasa" : "normal" },
        {
          icono: "escudo",
          valor: `${resumen.brigadas_disponibles ?? 0}/${resumen.brigadas_total ?? 0}`,
          etiqueta: "Brigadas disponibles",
          tono: "normal",
        },
        {
          icono: "ubicacion",
          valor: resumen.zonas_criticas ?? 0,
          etiqueta: "Zonas críticas",
          tono: "normal",
        },
      ];
      if (esAdmin) {
        lista.push({
          icono: "capas",
          valor: `Bs. ${Number(resumen.costo_danos_estimado_total || 0).toLocaleString("es-BO")}`,
          etiqueta: "Costo estimado total",
          tono: "normal",
        });
      }
      return lista;
    }
    if (esBombero) {
      const asignaciones = datos.asignaciones || [];
      const activas = asignaciones.filter(
        (a) => a.estado_incidente !== "CERRADO" && a.estado_asignacion !== "LIBERADA"
      ).length;
      const esteMes = asignaciones.filter((a) => enEsteMes(a.fecha_inicio || a.fecha_asignacion)).length;
      const misInformes = (datos.expediente?.informes || []).filter(
        (i) => i.id_bombero === idPersona
      ).length;
      return [
        { icono: "llama", valor: activas, etiqueta: "Asignaciones activas", tono: activas ? "critico" : "normal" },
        { icono: "incidente", valor: esteMes, etiqueta: "Incendios en el mes", tono: "fuego" },
        { icono: "escudo", valor: datos.misBrigadas?.length ?? 0, etiqueta: "Mis brigadas", tono: "normal" },
        { icono: "check", valor: misInformes, etiqueta: "Mis informes aquí", tono: "normal" },
      ];
    }
    const avisos = datos.avisos || [];
    const zonas = datos.zonas || [];
    return [
      { icono: "alerta", valor: avisos.filter((a) => a.estado_aviso === "PENDIENTE").length, etiqueta: "Avisos pendientes", tono: "brasa" },
      { icono: "check", valor: avisos.length, etiqueta: "Mis avisos", tono: "normal" },
      {
        icono: "ubicacion",
        valor: zonas.filter((z) => ["ALTO", "EXTREMO"].includes(z.nivel_riesgo)).length,
        etiqueta: "Zonas de riesgo alto",
        tono: "critico",
      },
    ];
  }, [esAdmin, esOperador, esBombero, datos, idPersona]);

  function abrirIncidente(vista = "detalle") {
    setVistaIncidente(vista);
    navigate("/incidentes");
  }

  const coords = coordsDe(incidente);
  const esVistaOperativa = esAdmin || esOperador || esBombero;
  const nombreBombero = [usuario?.persona?.nombres, usuario?.persona?.apellidos]
    .filter(Boolean)
    .join(" ");
  const timeline = (datos.expediente?.timeline || []).filter((evento) => {
    if (!esAdmin && evento.tipo === "EVALUACION_DANOS") return false;
    if (!esBombero) return true;
    if (!["BRIGADA_ASIGNADA", "INFORME_BOMBERO"].includes(evento.tipo)) return true;
    const texto = `${evento.titulo || ""} ${evento.detalle || ""}`;
    if (evento.tipo === "BRIGADA_ASIGNADA") {
      return Boolean(datos.activa?.brigada && texto.includes(datos.activa.brigada));
    }
    return Boolean(nombreBombero && texto.includes(nombreBombero));
  });
  const brigadas = datos.expediente?.brigadas || [];
  const brigadasVisibles = esBombero
    ? brigadas.filter((b) => b.id_brigada === datos.activa?.id_brigada)
    : brigadas;
  const cantidadBrigadas = esBombero
    ? brigadasVisibles.length || (datos.activa?.brigada ? 1 : 0)
    : brigadas.length;
  const informes = datos.expediente?.informes || [];
  const evaluacion = datos.expediente?.evaluacion_danos || null;
  const zonas = datos.zonas || [];
  const zonasCriticas = zonas.filter(
    (z) => ["ALTO", "EXTREMO"].includes(z.nivel_riesgo) || z.estado === "Alerta Emitida"
  );
  const ultimoAviso = (datos.avisos || [])[0] || null;

  return (
    <AppLayout ancha suelta>
      <div className="dash-pagina">
        <header className="dash-cabecera">
          <div>
            <span className="dash-etiqueta">Panel principal · información prioritaria</span>
            <h1>{esCiudadano ? "Tu seguridad, al día" : "Centro de mando"}</h1>
            <p>
              {esCiudadano
                ? "Consulta el estado de tus avisos y las zonas de riesgo de tu entorno."
                : "El incidente más reciente y la respuesta en campo, primero; el resto del detalle después."}
            </p>
          </div>
          <div className="dash-cabecera-acciones">
            <span className="dash-rol">{ETIQUETA_ROL[rol] || rol}</span>
            <button
              type="button"
              className="vg-boton-secundario"
              onClick={() => setRefresco((n) => n + 1)}
              disabled={cargando}
            >
              <Icono nombre="capas" tamano={16} /> Actualizar
            </button>
          </div>
        </header>

        {error && <p className="aviso">{error}</p>}

        {cargando ? (
          <div className="dash-estado">Cargando información del panel…</div>
        ) : (
          <>
            {esVistaOperativa ? (
              <section className={`dash-hero${incidente?.estado === "ACTIVO" ? " dash-hero-activo" : ""}`}>
                <div className="dash-hero-cabecera">
                  <div>
                    <span className="dash-hero-etiqueta">
                      {datos.activo || datos.activa
                        ? "Incidente activo ahora"
                        : "Último incidente registrado"}
                    </span>
                    <h2>
                      {incidente
                        ? `Incidente #${incidente.id_incidente}`
                        : "Sin incidentes registrados"}
                    </h2>
                  </div>
                  <div className="dash-hero-chips">
                    {incidente && <EstadoChip valor={incidente.estado} />}
                    {incidente && <EstadoChip valor={incidente.gravedad} gravedad />}
                  </div>
                </div>

                {incidente ? (
                  <>
                    <div className="dash-hero-cuerpo">
                      <div className="dash-hero-principal">
                        <span className="dash-hero-icono"><Icono nombre="llama" tamano={28} /></span>
                        <div>
                          <small>Ubicación del incendio</small>
                          <strong>{incidente.ubicacion || "Ubicación sin registrar"}</strong>
                          <p>
                            {coords
                              ? `Coordenadas ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                              : "Coordenadas no registradas en el aviso"}
                          </p>
                          {coords && (
                            <a href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`} target="_blank" rel="noreferrer">
                              Ver en el mapa <Icono nombre="chevronDerecha" tamano={14} />
                            </a>
                          )}
                        </div>
                      </div>
                      <dl className="dash-hero-datos">
                        <div><dt>Inicio</dt><dd>{fechaLegible(incidente.fecha_inicio)}</dd></div>
                        <div><dt>Duración</dt><dd>{duracionLegible(incidente.duracion_min)}</dd></div>
                        {!esBombero && (
                          <div>
                            <dt>Operador</dt>
                            <dd>{datos.expediente?.operador?.nombre_completo || "Sin asignar"}</dd>
                          </div>
                        )}
                        {esBombero && (
                          <div>
                            <dt>Mi brigada</dt>
                            <dd>{datos.activa?.brigada || datos.misBrigadas?.[0]?.nombre || "Sin asignar"}</dd>
                          </div>
                        )}
                        <div>
                          <dt>Brigadas a cargo</dt>
                          <dd>{cantidadBrigadas}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="dash-hero-acciones">
                      <button type="button" className="boton boton-oscuro" onClick={() => abrirIncidente("detalle")}>
                        <Icono nombre="incidente" tamano={16} /> Ver expediente completo
                      </button>
                      <button
                        type="button"
                        className="vg-boton-secundario"
                        onClick={() => abrirIncidente(esBombero ? "incidentes" : "mapa_alertas")}
                      >
                        <Icono nombre="ubicacion" tamano={16} /> Ver en el mapa operativo
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="dash-hero-vacio">
                    <Icono nombre="check" tamano={30} />
                    <div>
                      <h3>No hay incendios activos ni incidentes registrados</h3>
                      <p>Cuando se reporte un aviso y se confirme un incendio, aparecerá aquí de inmediato.</p>
                    </div>
                    <button type="button" className="boton boton-oscuro" onClick={() => abrirIncidente("mapa_alertas")}>
                      Ir a incidentes
                    </button>
                  </div>
                )}
              </section>
            ) : (
              <section className="dash-hero dash-hero-ciudadano">
                <div className="dash-hero-cuerpo">
                  <div className="dash-hero-principal">
                    <span className="dash-hero-icono"><Icono nombre="alerta" tamano={28} /></span>
                    <div>
                      <span className="dash-hero-etiqueta">Atención ciudadana</span>
                      <h2>¿Ves humo o fuego?</h2>
                      <p>Reporta un aviso con tu ubicación. El operador lo valida y coordina la respuesta.</p>
                    </div>
                  </div>
                  <div className="dash-hero-datos">
                    <div>
                      <dt>Tu último aviso</dt>
                      <dd>
                        {ultimoAviso
                          ? `#${ultimoAviso.id_aviso} · ${ultimoAviso.estado_aviso} · ${fechaLegible(ultimoAviso.fecha_hora)}`
                          : "Aún no tienes avisos registrados"}
                      </dd>
                    </div>
                  </div>
                </div>
                <div className="dash-hero-acciones">
                  <button type="button" className="boton boton-oscuro" onClick={() => abrirIncidente("mapa_alertas")}>
                    <Icono nombre="llama" tamano={16} /> {ultimoAviso ? "Reportar otro aviso" : "Reportar incendio"}
                  </button>
                </div>
              </section>
            )}

            <div className="dash-kpis">
              {kpis.map((kpi) => <Kpi key={kpi.etiqueta} {...kpi} />)}
            </div>

            <div className="dash-rejilla">
              <div className="dash-columna-principal">
                {esVistaOperativa && incidente && (
                  <Seccion
                    titulo="Cómo se atendió este incendio"
                    descripcion="Línea de tiempo del aviso, el despacho y el trabajo en campo."
                  >
                    {timeline.length ? (
                      <ol className="dash-timeline">
                        {timeline.slice(0, 6).map((evento, indice) => (
                          <EventoTimeline key={`${evento.timestamp}-${indice}`} evento={evento} mostrarCosto={esAdmin} />
                        ))}
                      </ol>
                    ) : (
                      <p className="dash-vacio">
                        {esBombero
                          ? "No hay eventos visibles para tu brigada en este incidente."
                          : "Todavía no hay eventos registrados en el expediente."}
                      </p>
                    )}
                  </Seccion>
                )}

                {esVistaOperativa && incidente && (
                  <Seccion titulo="Brigadas a cargo" descripcion="Quiénes fueron despachados y quiénes lideran cada cuadrilla.">
                    {brigadasVisibles.length ? (
                      <div className="dash-tarjetas">
                        {brigadasVisibles.map((brigada) => (
                          <BrigadaCard key={`${brigada.id_incidente}-${brigada.id_brigada}`} brigada={brigada} />
                        ))}
                      </div>
                    ) : (
                      <p className="dash-vacio">Todavía no hay brigadas asignadas a este incidente.</p>
                    )}
                  </Seccion>
                )}

                {esVistaOperativa && incidente && (
                  <Seccion titulo="Bomberos que intervinieron" descripcion="Informes de campo registrados para este incidente.">
                    {informes.length ? (
                      <div className="dash-tarjetas">
                        {informes
                          .filter((i) => !esBombero || i.id_bombero === idPersona)
                          .map((informe) => <InformeCard key={informe.id_informe} informe={informe} />)}
                        {esBombero && informes.length > 0 && informes.every((i) => i.id_bombero !== idPersona) && (
                          <p className="dash-vacio">Todavía no registraste informes en este incidente.</p>
                        )}
                      </div>
                    ) : (
                      <p className="dash-vacio">Todavía no hay informes de bomberos registrados.</p>
                    )}
                  </Seccion>
                )}

                {(esAdmin || esOperador) && evaluacion && (
                  <Seccion titulo="Evaluación de daños" descripcion="Resultado del último levantamiento de daños.">
                    <div className="dash-danos">
                      <div><small>Tipo de daño</small><strong>{evaluacion.tipo_dano}</strong></div>
                      <div><small>Nivel</small><strong>{evaluacion.nivel_dano}</strong></div>
                      {esAdmin && (
                        <div><small>Costo estimado</small><strong>Bs. {Number(evaluacion.costo_estimado || 0).toLocaleString("es-BO")}</strong></div>
                      )}
                      <div className="dash-danos-descripcion"><small>Descripción</small><p>{evaluacion.descripcion || "Sin descripción"}</p></div>
                    </div>
                  </Seccion>
                )}

                {esBombero && (
                  <Seccion titulo="Mis asignaciones" descripcion="Incidencias despachadas a mi brigada, más recientes primero.">
                    {(datos.asignaciones || []).length ? (
                      <ul className="dash-lista">
                        {datos.asignaciones.slice(0, 5).map((a) => (
                          <li className="dash-lista-item" key={`${a.id_incidente}-${a.id_brigada}`}>
                            <span className="dash-lista-icono"><Icono nombre="escudo" tamano={17} /></span>
                            <div>
                              <strong>Incidente #{a.id_incidente} · {a.brigada}</strong>
                              <small>
                                {a.ubicacion || "Ubicación sin registrar"} · {a.estado_asignacion} · {fechaLegible(a.fecha_asignacion)}
                              </small>
                            </div>
                            <EstadoChip valor={a.estado_incidente || "ACTIVO"} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="dash-vacio">No tienes asignaciones visibles en este momento.</p>
                    )}
                  </Seccion>
                )}

                {esCiudadano && (
                  <Seccion titulo="Tus avisos recientes" descripcion="Sigue el estado de los reportes que enviaste.">
                    {(datos.avisos || []).length ? (
                      <ul className="dash-lista">
                        {datos.avisos.slice(0, 5).map((aviso) => <AvisoCard key={aviso.id_aviso} aviso={aviso} />)}
                      </ul>
                    ) : (
                      <div className="dash-vacio">
                        <p>Aún no has reportado ningún aviso.</p>
                        <button type="button" className="vg-boton-secundario" onClick={() => abrirIncidente("mapa_alertas")}>
                          Reportar un incendio
                        </button>
                      </div>
                    )}
                  </Seccion>
                )}
              </div>

              <aside className="dash-columna-lateral">
                {(esAdmin || esOperador) && (
                  <Seccion titulo="Avisos que requieren atención" descripcion="Triage pendiente y verificado.">
                    {(datos.avisos || []).length ? (
                      <ul className="dash-lista">
                        {datos.avisos.map((aviso) => <AvisoCard key={aviso.id_aviso} aviso={aviso} />)}
                      </ul>
                    ) : (
                      <p className="dash-vacio">No hay avisos pendientes ni verificados.</p>
                    )}
                    <button type="button" className="dash-enlace" onClick={() => abrirIncidente("avisos")}>
                      Ir al triage <Icono nombre="chevronDerecha" tamano={14} />
                    </button>
                  </Seccion>
                )}

                {!esBombero && (
                  <Seccion titulo="Zonas de riesgo" descripcion={esCiudadano ? "Prioriza tu zona si hay riesgo alto." : "Áreas con riesgo alto, extremo o alerta emitida."}>
                    {zonasCriticas.length ? (
                      <ul className="dash-lista">
                        {zonasCriticas.slice(0, 5).map((zona) => <ZonaCard key={zona.id_zona} zona={zona} />)}
                      </ul>
                    ) : (
                      <p className="dash-vacio">No hay zonas en alerta en este momento.</p>
                    )}
                    <button type="button" className="dash-enlace" onClick={() => navigate("/zonas-riesgo")}>
                      Ver todas las zonas <Icono nombre="chevronDerecha" tamano={14} />
                    </button>
                  </Seccion>
                )}

                {esBombero && (
                  <Seccion titulo="Mi brigada" descripcion="Disponibilidad y rol dentro del equipo.">
                    {(datos.misBrigadas || []).length ? (
                      <ul className="dash-lista">
                        {datos.misBrigadas.map((brigada) => (
                          <li className="dash-lista-item" key={brigada.id_brigada}>
                            <span className="dash-lista-icono"><Icono nombre="escudo" tamano={17} /></span>
                            <div>
                              <strong>{brigada.nombre}</strong>
                              <small>
                                {brigada.rol_en_brigada?.replaceAll("_", " ").toLowerCase() || "Integrante"}
                                {brigada.estacion ? ` · ${brigada.estacion}` : ""}
                              </small>
                            </div>
                            <span className={`dash-chip dash-chip-${brigada.disponible ? "normal" : "brasa"}`}>
                              {brigada.disponible ? "Disponible" : "En operación"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="dash-vacio">Aún no perteneces a una brigada activa.</p>
                    )}
                    <button type="button" className="dash-enlace" onClick={() => navigate("/brigadas/incendios")}>
                      Ver incendios asignados <Icono nombre="chevronDerecha" tamano={14} />
                    </button>
                  </Seccion>
                )}

                {esCiudadano && (
                  <Seccion titulo="Cómo reportar" descripcion="Tres pasos para que tu aviso llegue al centro de mando.">
                    <ol className="dash-pasos">
                      <li><span>1</span><div><strong>Ubica el punto</strong><p>Usa el mapa o escribe la dirección y referencias cercanas.</p></div></li>
                      <li><span>2</span><div><strong>Describe lo que ves</strong><p>Humo, llama, tamaño aproximado y si hay personas en riesgo.</p></div></li>
                      <li><span>3</span><div><strong>Envía tu aviso</strong><p>Recibirás un número de seguimiento y podrás ver su estado aquí.</p></div></li>
                    </ol>
                  </Seccion>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
