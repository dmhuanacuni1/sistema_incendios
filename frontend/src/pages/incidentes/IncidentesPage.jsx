import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import Icono from '../../components/layout/IconosVigia';
import { estadoAsignacion } from '../../components/brigadas/estadosBrigada';
import { StatusBadge } from '../../components/common/StatusBadge';
import { TacticalMap } from '../../components/common/TacticalMap';
import { useOperacion } from '../../context/OperacionContext';
import { useVigia } from '../../context/VigiaContext';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { usePolling } from '../../hooks/usePolling';
import * as brigadasService from '../../services/brigadasService';
import * as estacionesService from '../../services/estacionesService';
import {
  avisosService,
  despachoBrigadasService,
  evaluacionDanosService,
  incidentesService,
  informesBomberoService,
} from '../../services/incidentesService';
import { AvisosPanel } from './AvisosPanel';
import { CiudadanoPortal } from './CiudadanoPortal';
import { DescartarAvisoModal } from './DescartarAvisoModal';
import { ExpedienteModal } from './ExpedienteModal';
import { IncidenteDetallePanel } from './IncidenteDetallePanel';
import { ValidarClasificarModal } from './ValidarClasificarModal';
import '../../styles/incidentes.css';

const GRAVEDADES = ['BAJA', 'MEDIA', 'ALTA', 'CATASTROFICA'];
const ESTADOS_FILTRO = ['', 'ACTIVO', 'CONTROLADO', 'EXTINGUIDO', 'CERRADO'];

function reproducirTonoAlertaCad() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const beep = (startOffset, freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + 0.22);
    };
    beep(0, 880);
    beep(0.26, 1175);
  } catch {
    // Ignorar si el navegador bloquea autoplay de audio antes de interacción
  }
}

export function IncidentesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    rolActivo,
    usuarioAutenticado,
    autoRefresh,
    marcarSincronizado,
    vistaIncidente: vistaActiva,
    setVistaIncidente: setVistaActiva,
    setNavBadges,
  } = useOperacion();
  const { estaciones, cargarEstaciones, abrirEstacion } = useVigia();
  const { loading, error, setError, run } = useAsyncAction();
  const [notice, setNotice] = useState('');

  const [referencias, setReferencias] = useState({
    personas: [],
    zonas: [],
    brigadas: [],
  });
  const [resumen, setResumen] = useState(null);

  const [avisos, setAvisos] = useState([]);
  const [gruposTriangulados, setGruposTriangulados] = useState([]);
  const [firmsData, setFirmsData] = useState(null);
  const [capaSatelitalActiva, setCapaSatelitalActiva] = useState(false);
  const [firmsSimulado, setFirmsSimulado] = useState(false);
  const [firmsDays, setFirmsDays] = useState(3);
  const [misAvisos, setMisAvisos] = useState([]);
  const [ultimoAvisoCiudadanoId, setUltimoAvisoCiudadanoId] = useState(null);
  const [filtroAviso, setFiltroAviso] = useState('POR_ATENDER');
  const [pickedPoint, setPickedPoint] = useState(null);
  const [avisosCercanos, setAvisosCercanos] = useState([]);
  const [alertaEntrante, setAlertaEntrante] = useState(null);
  const [sonidoAlertaActivo, setSonidoAlertaActivo] = useState(true);
  const seenAvisosRef = useRef(null);
  const sonidoRef = useRef(sonidoAlertaActivo);

  useEffect(() => {
    sonidoRef.current = sonidoAlertaActivo;
  }, [sonidoAlertaActivo]);

  const [incidentes, setIncidentes] = useState([]);
  const [filtroIncidente, setFiltroIncidente] = useState('');
  const [filtroGravedad, setFiltroGravedad] = useState('');
  const [filtroZona, setFiltroZona] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const [brigadas, setBrigadas] = useState([]);
  const [misIncendiosBrigada, setMisIncendiosBrigada] = useState([]);
  const [notificacionesBrigada, setNotificacionesBrigada] = useState([]);
  const [informes, setInformes] = useState([]);
  const [evaluacion, setEvaluacion] = useState(null);
  const [expedienteActivo, setExpedienteActivo] = useState(null);
  const [objetivoValidacion, setObjetivoValidacion] = useState(null);
  const [avisoADescartar, setAvisoADescartar] = useState(null);

  const [ubicacion, setUbicacion] = useState('');
  const [gravedad, setGravedad] = useState('MEDIA');
  const [idZona, setIdZona] = useState('');
  const [idOperador, setIdOperador] = useState('');
  const [mostrarFormIncidente, setMostrarFormIncidente] = useState(false);

  const cargarReferencias = useCallback(async () => {
    const res = await incidentesService.referencias();
    setReferencias(res.data || { personas: [], zonas: [], brigadas: [] });
  }, []);

  const cargarResumen = useCallback(async () => {
    const res = await incidentesService.resumenOperativo();
    setResumen(res.data || null);
  }, []);

  const cargarAvisos = useCallback(async () => {
    const [res, grpRes] = await Promise.all([
      avisosService.listar({}),
      avisosService.agrupados(2.5, 2).catch(() => ({ data: [] })),
    ]);
    const lista = res.data || [];
    setAvisos(lista);
    setGruposTriangulados(grpRes.data || []);

    if (seenAvisosRef.current === null) {
      seenAvisosRef.current = new Set(lista.map((a) => a.id_aviso));
    } else {
      const nuevosPrioritarios = lista.filter(
        (a) =>
          !seenAvisosRef.current.has(a.id_aviso) &&
          a.estado_aviso === 'PENDIENTE' &&
          (a.nivel_urgencia === 'CRITICO' || a.nivel_urgencia === 'ALTO')
      );
      lista.forEach((a) => seenAvisosRef.current.add(a.id_aviso));
      if (nuevosPrioritarios.length > 0) {
        setAlertaEntrante(nuevosPrioritarios[0]);
        if (sonidoRef.current) {
          reproducirTonoAlertaCad();
        }
      }
    }
  }, []);

  const cargarIncidentes = useCallback(async () => {
    const res = await incidentesService.listar({
      estado: filtroIncidente,
      gravedad: filtroGravedad,
      id_zona: filtroZona,
    });
    setIncidentes(res.data || []);
  }, [filtroIncidente, filtroGravedad, filtroZona]);

  const cargarDetalle = useCallback(async (idIncidente) => {
    if (!idIncidente) {
      setBrigadas([]);
      setInformes([]);
      setEvaluacion(null);
      return;
    }

    const [bRes, iRes] = await Promise.all([
      despachoBrigadasService.listar(idIncidente),
      informesBomberoService.listar(idIncidente),
    ]);
    setBrigadas(bRes.data || []);
    setInformes(iRes.data || []);

    try {
      const eRes = await evaluacionDanosService.obtener(idIncidente);
      setEvaluacion(eRes.data);
    } catch {
      setEvaluacion(null);
    }
  }, []);

  const esCiudadano = rolActivo === 'CIUDADANO';
  const esCiudadanoAutenticado = usuarioAutenticado?.rol === 'CIUDADANO';
  const esBomberoReal = usuarioAutenticado?.rol === 'BOMBERO';

  const misAvisosRef = useRef(misAvisos);
  useEffect(() => {
    misAvisosRef.current = misAvisos;
  }, [misAvisos]);

  const cargarMisAvisosCiudadano = useCallback(async () => {
    if (esCiudadanoAutenticado) {
      const res = await avisosService.mios();
      setMisAvisos(res.data || []);
      return;
    }

    const ids = Array.from(
      new Set(
        [
          ultimoAvisoCiudadanoId,
          ...misAvisosRef.current.map((a) => a.id_aviso),
        ].filter(Boolean)
      )
    ).slice(0, 5);

    if (ids.length === 0) return;

    const obtenidos = await Promise.all(
      ids.map((id) =>
        avisosService
          .obtener(id)
          .then((r) => r.data)
          .catch(() => null)
      )
    );
    const mapa = new Map(
      obtenidos.filter(Boolean).map((av) => [av.id_aviso, av])
    );
    if (mapa.size === 0) return;

    setMisAvisos((prev) => {
      const actualizados = prev.map((item) => mapa.get(item.id_aviso) || item);
      mapa.forEach((av, id) => {
        if (!actualizados.some((item) => item.id_aviso === id)) {
          actualizados.unshift(av);
        }
      });
      return actualizados;
    });
  }, [esCiudadanoAutenticado, ultimoAvisoCiudadanoId]);

  const cargarDatosBrigadaBombero = useCallback(async () => {
    if (!esBomberoReal) {
      setMisIncendiosBrigada([]);
      setNotificacionesBrigada([]);
      return;
    }
    const [incendiosAsig, notifs] = await Promise.all([
      brigadasService.incendiosAsignados().catch(() => []),
      brigadasService.misNotificaciones().catch(() => []),
    ]);
    setMisIncendiosBrigada(Array.isArray(incendiosAsig) ? incendiosAsig : []);
    setNotificacionesBrigada(Array.isArray(notifs) ? notifs : []);
  }, [esBomberoReal]);

  const cargarSateliteFirms = useCallback(
    async (opts = {}) => {
      if (esCiudadano) {
        setFirmsData(null);
        return;
      }
      const usarSimulado = opts.simulado ?? firmsSimulado;
      const usarDays = opts.days ?? firmsDays;
      const res = await incidentesService
        .sateliteFirms({
          days: String(usarDays),
          simulado: usarSimulado ? '1' : undefined,
          refresh: opts.refresh ? '1' : undefined,
        })
        .catch(() => null);
      if (res?.data) {
        setFirmsData(res.data);
      }
    },
    [esCiudadano, firmsSimulado, firmsDays]
  );

  const sincronizarTodo = useCallback(async () => {
    if (esCiudadano) {
      await Promise.all([cargarReferencias(), cargarMisAvisosCiudadano()]);
      marcarSincronizado();
      return;
    }

    await Promise.all([
      cargarAvisos(),
      cargarIncidentes(),
      cargarResumen(),
      cargarReferencias(),
      cargarDatosBrigadaBombero(),
      cargarSateliteFirms(),
    ]);
    if (selectedId) {
      await cargarDetalle(selectedId);
    }
    marcarSincronizado();
  }, [
    esCiudadano,
    cargarMisAvisosCiudadano,
    cargarAvisos,
    cargarIncidentes,
    cargarResumen,
    cargarReferencias,
    cargarDatosBrigadaBombero,
    cargarSateliteFirms,
    cargarDetalle,
    selectedId,
    marcarSincronizado,
  ]);

  useEffect(() => {
    const idParam = Number(searchParams.get('incidente'));
    if (idParam > 0 && !esCiudadano) {
      setSelectedId(idParam);
      setVistaActiva('detalle');
    }
  }, [searchParams, esCiudadano, setVistaActiva]);

    // EFECTO PARA REDIRECCIÓN DESDE LA CAMPANITA (Protegido contra el polling)
  const redireccionProcesada = useRef(false);

  useEffect(() => {
    // Si ya procesamos la redirección, no hacemos nada (evita que el polling nos devuelva a la vista)
    if (redireccionProcesada.current) return;

    if (location.state?.avisoSeleccionadoId) {
      redireccionProcesada.current = true;
      const idAviso = Number(location.state.avisoSeleccionadoId);
      
      setVistaActiva('avisos');
      const avisoEncontrado = avisos.find((a) => a.id_aviso === idAviso);
      
      if (avisoEncontrado && (avisoEncontrado.estado_aviso === 'PENDIENTE' || avisoEncontrado.estado_aviso === 'VERIFICADO')) {
        setObjetivoValidacion({ tipo: 'aviso', aviso: avisoEncontrado });
      }
      
      // Limpiamos el estado correctamente usando navigate, para que React Router lo olvide
      navigate(location.pathname, { replace: true, state: {} });
    } 
    else if (location.state?.incidenteSeleccionadoId) {
      redireccionProcesada.current = true;
      setSelectedId(Number(location.state.incidenteSeleccionadoId));
      setVistaActiva('detalle');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, avisos, navigate, setVistaActiva, location.pathname]);

  useEffect(() => {
    if (esCiudadano) {
      setSelectedId(null);
      setExpedienteActivo(null);
      setVistaActiva('ciudadano_sos');
    } else {
      setVistaActiva((actual) => {
        const validas =
          rolActivo === 'BOMBERO'
            ? ['mapa_alertas', 'incidentes', 'detalle']
            : ['mapa_alertas', 'avisos', 'incidentes', 'detalle'];
        return validas.includes(actual) ? actual : 'mapa_alertas';
      });
    }
    run(sincronizarTodo).catch(() => {});
  }, [rolActivo, esCiudadano, cargarAvisos, cargarIncidentes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId || esCiudadano) return;
    run(() => cargarDetalle(selectedId)).catch(() => {});
  }, [selectedId, esCiudadano, cargarDetalle, run]);

  usePolling(() => {
    sincronizarTodo().catch(() => {});
  }, 8000, autoRefresh);

  function notify(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  }

  async function handleCrearAviso(data) {
    await run(async () => {
      const res = await avisosService.crear(data);
      const creado = res.data;
      if (esCiudadano && creado) {
        setMisAvisos((prev) => [
          creado,
          ...prev.filter((item) => item.id_aviso !== creado.id_aviso),
        ]);
        setUltimoAvisoCiudadanoId(creado.id_aviso);
      } else {
        setPickedPoint(null);
        await Promise.all([cargarAvisos(), cargarResumen()]);
      }
      notify(
        esCiudadano
          ? `Reporte #${creado?.id_aviso ?? ''} enviado a la central`
          : 'Aviso registrado correctamente'
      );
    });
  }

  async function handleEnviarDescripcionIncendio(idAviso, data) {
    await run(async () => {
      const res = await avisosService.enviarDescripcion(idAviso, data);
      const actualizado = res.data;
      if (actualizado) {
        setMisAvisos((prev) => {
          const existe = prev.some((item) => item.id_aviso === actualizado.id_aviso);
          return existe
            ? prev.map((item) =>
                item.id_aviso === actualizado.id_aviso ? actualizado : item
              )
            : [actualizado, ...prev];
        });
      }
      if (!esCiudadano) {
        await cargarAvisos();
      }
      notify(`Descripción enviada para el reporte #${idAviso}`);
    });
  }

  async function handleCrearAvisoConDescripcion({
    ubicacion: refUbicacion,
    descripcion,
    nivel_urgencia,
    pickedPoint: punto,
  }) {
    const coords = punto || { lat: -17.314, lng: -66.181 };
    await handleCrearAviso({
      ubicacion: refUbicacion,
      descripcion,
      nivel_urgencia,
      id_ciudadano: null,
      lat: coords.lat,
      lng: coords.lng,
    });
  }

  async function handleCambiarEstadoAviso(idAviso, estado, motivo = null) {
    await run(async () => {
      await avisosService.cambiarEstado(idAviso, estado, motivo);
      await Promise.all([cargarAvisos(), cargarResumen()]);
      notify(`Aviso #${idAviso} actualizado a ${estado}`);
    });
  }

  async function handleConvertirAIncidente(aviso, clasificacion = null) {
    const mapGravedad = {
      BAJO: 'BAJA',
      MEDIO: 'MEDIA',
      ALTO: 'ALTA',
      CRITICO: 'CATASTROFICA',
    };
    await run(async () => {
      const payload = {
        id_aviso: aviso.id_aviso,
        ubicacion: clasificacion?.ubicacion || aviso.ubicacion,
        gravedad: clasificacion?.gravedad || mapGravedad[aviso.nivel_urgencia] || 'MEDIA',
      };
      if (clasificacion && clasificacion.id_zona != null) {
        payload.id_zona = clasificacion.id_zona;
      }
      const res = await incidentesService.crear(payload);
      await Promise.all([cargarAvisos(), cargarIncidentes(), cargarResumen()]);
      setSelectedId(res.data.id_incidente);
      notify(`Incidente #${res.data.id_incidente} creado desde aviso #${aviso.id_aviso}`);
    });
  }

  async function handleVincularAvisoAIncidente(aviso, inc) {
    await run(async () => {
      await avisosService.enviarDescripcion(aviso.id_aviso, {
        descripcion: `Vinculado al Incidente activo #${inc.id_incidente} (${inc.ubicacion})`,
        append: true,
      });
      await avisosService.cambiarEstado(aviso.id_aviso, 'ATENDIDO');
      await Promise.all([cargarAvisos(), cargarResumen()]);
      setSelectedId(inc.id_incidente);
      notify(
        `Aviso #${aviso.id_aviso} fusionado/vinculado con Incidente #${inc.id_incidente}`
      );
    });
  }

  async function handleConsolidarGrupo(grupo, clasificacion = null) {
    await run(async () => {
      const idZonaFinal =
        clasificacion && 'id_zona' in clasificacion
          ? clasificacion.id_zona
          : grupo.zona_sugerida?.id_zona || null;
      const payload = {
        ids_avisos: grupo.ids_avisos,
        gravedad: clasificacion?.gravedad || grupo.gravedad_sugerida,
        id_zona: idZonaFinal,
      };
      if (clasificacion?.ubicacion) {
        payload.ubicacion = clasificacion.ubicacion;
      }
      const res = await avisosService.consolidarGrupo(payload);
      const nuevoInc = res.data?.incidente;
      await Promise.all([cargarAvisos(), cargarIncidentes(), cargarResumen()]);
      if (nuevoInc?.id_incidente) {
        setSelectedId(nuevoInc.id_incidente);
        setVistaActiva('detalle');
      }
      notify(
        `Grupo de ${grupo.cantidad_avisos} alarmas triangulado y consolidado en Incidente #${
          nuevoInc?.id_incidente ?? ''
        }`
      );
    });
  }

  async function handleSimularDiezAlarmasZona() {
    await run(async () => {
      const baseLat = pickedPoint?.lat ?? -17.314;
      const baseLng = pickedPoint?.lng ?? -66.181;
      const offsets = [
        [0.0012, -0.0015],
        [-0.0018, 0.0011],
        [0.0021, 0.0019],
        [-0.0011, -0.0022],
        [0.0005, 0.0024],
        [-0.0023, -0.0007],
        [0.0017, -0.0004],
        [-0.0006, 0.0016],
        [0.0024, -0.0018],
        [-0.0015, -0.0014],
      ];
      for (let i = 0; i < offsets.length; i += 1) {
        const [dLat, dLng] = offsets[i];
        await avisosService.crear({
          lat: Number((baseLat + dLat).toFixed(4)),
          lng: Number((baseLng + dLng).toFixed(4)),
          descripcion: `Llamado ciudadano #${i + 1} reportando columna de humo en la misma ladera`,
          nivel_urgencia: i % 3 === 0 ? 'CRITICO' : 'ALTO',
        });
      }
      await Promise.all([cargarAvisos(), cargarResumen()]);
      setPickedPoint({ lat: baseLat, lng: baseLng });
      notify('10 alarmas cercanas simuladas y trianguladas automáticamente en 1 grupo');
    });
  }

  function handleToggleCapaSatelital() {
    setCapaSatelitalActiva((prev) => {
      const next = !prev;
      if (next && !firmsData) {
        cargarSateliteFirms({ simulado: firmsSimulado }).catch(() => {});
      }
      return next;
    });
  }

  async function handleToggleSimulacionFirms() {
    const next = !firmsSimulado;
    setFirmsSimulado(next);
    setCapaSatelitalActiva(true);
    await run(() => cargarSateliteFirms({ simulado: next }));
    notify(
      next
        ? 'Pasada satelital demostrativa NASA FIRMS activada'
        : 'Modo satelital en vivo restaurado'
    );
  }

  async function handleRefrescarFirms() {
    await run(() => cargarSateliteFirms({ simulado: firmsSimulado, refresh: true }));
    notify('Lectura satelital NASA FIRMS actualizada');
  }

  async function handleCambiarDiasFirms(nextDays) {
    setFirmsDays(nextDays);
    setCapaSatelitalActiva(true);
    await run(() => cargarSateliteFirms({ simulado: firmsSimulado, days: nextDays }));
    notify(
      nextDays === 5
        ? 'Ventana satelital ajustada a últimos 5 días'
        : `Ventana satelital ajustada a últimas ${nextDays * 24}h`
    );
  }

  async function handleCrearAvisoDesdeSatelite(focoSat) {
    if (!focoSat?.coordenadas) return;
    await run(async () => {
      const ubicacionSug = focoSat.zona_cercana
        ? `Anomalía térmica satelital — sector ${focoSat.zona_cercana.nombre}`
        : focoSat.departamento
        ? `Anomalía térmica satelital — Dpto. ${focoSat.departamento} (${focoSat.coordenadas.lat}, ${focoSat.coordenadas.lng})`
        : 'Anomalía térmica satelital NASA FIRMS';
      const desc = `[Canal: Satélite NASA FIRMS] Detección ${
        focoSat.instrumento || 'VIIRS'
      } (${focoSat.sensor}) · Confianza ${focoSat.confianza} · Potencia ${
        focoSat.frp_mw
      } MW · Temp. brillo ${focoSat.temperatura_brillo_c ?? '—'} °C`;

      const res = await avisosService.crear({
        ubicacion: ubicacionSug,
        lat: focoSat.coordenadas.lat,
        lng: focoSat.coordenadas.lng,
        descripcion: desc,
        nivel_urgencia: focoSat.nivel_urgencia_sugerido || 'ALTO',
      });
      await Promise.all([cargarAvisos(), cargarResumen(), cargarSateliteFirms()]);
      notify(
        `Aviso #${res.data?.id_aviso ?? ''} registrado en Triage desde NASA FIRMS`
      );
    });
  }

  async function handleCrearIncidenteDirecto(e) {
    e.preventDefault();
    if (!ubicacion.trim()) return;
    await run(async () => {
      const res = await incidentesService.crear({
        ubicacion: ubicacion.trim(),
        gravedad,
        id_zona: idZona ? Number(idZona) : null,
        id_operador: idOperador ? Number(idOperador) : null,
        ...(pickedPoint ? { lat: pickedPoint.lat, lng: pickedPoint.lng } : {}),
      });
      setUbicacion('');
      setIdZona('');
      setIdOperador('');
      setPickedPoint(null);
      setMostrarFormIncidente(false);
      await Promise.all([cargarIncidentes(), cargarResumen()]);
      setSelectedId(res.data.id_incidente);
      notify(`Incidente #${res.data.id_incidente} creado`);
    });
  }

  async function handleActualizarIncidente(idIncidente, data) {
    await run(async () => {
      await incidentesService.actualizar(idIncidente, data);
      await cargarIncidentes();
      notify(`Clasificación del incidente #${idIncidente} actualizada`);
    });
  }

  async function handleCambiarEstadoIncidente(idIncidente, estado) {
    await run(async () => {
      await incidentesService.cambiarEstado(idIncidente, estado);
      await Promise.all([cargarIncidentes(), cargarResumen()]);
      notify(`Incidente #${idIncidente} actualizado a ${estado}`);
    });
  }

  async function handleCerrarIncidente(idIncidente, abrirActaAlCerrar = false) {
    await run(async () => {
      await incidentesService.cerrar(idIncidente);

      const marca = `Incidente #${idIncidente}`;
      const retornos = [];
      for (const est of estaciones || []) {
        for (const u of est.unidades || []) {
          if (
            u.estado === 'EN_MISION' &&
            String(u.motivo_estado || '').includes(marca)
          ) {
            retornos.push(
              estacionesService.cambiarEstado(
                'unidad',
                u.id_unidad ?? u.id,
                'DISPONIBLE',
                `Retorno automático por cierre de ${marca}`
              )
            );
          }
        }
        for (const r of est.recursos || []) {
          if (
            r.estado === 'EN_USO' &&
            String(r.motivo_estado || '').includes(marca)
          ) {
            retornos.push(
              estacionesService.cambiarEstado(
                'recurso',
                r.id_recurso ?? r.id,
                'DISPONIBLE',
                `Liberación automática por cierre de ${marca}`
              )
            );
          }
        }
      }
      if (retornos.length > 0) {
        await Promise.allSettled(retornos);
      }

      const expPromise = abrirActaAlCerrar
        ? incidentesService.expediente(idIncidente)
        : Promise.resolve(null);

      const [, , , , , expRes] = await Promise.all([
        cargarIncidentes(),
        cargarDetalle(idIncidente),
        cargarResumen(),
        cargarReferencias(),
        cargarEstaciones(),
        expPromise,
      ]);
      if (expRes?.data) {
        setExpedienteActivo(expRes.data);
      }
      notify(
        retornos.length > 0
          ? `Incidente #${idIncidente} cerrado; brigadas y ${retornos.length} unidad(es)/recurso(s) retornados a base`
          : `Incidente #${idIncidente} cerrado y brigadas liberadas`
      );
    });
  }

  async function handleAsignarBrigada(idIncidente, data) {
    await run(async () => {
      await despachoBrigadasService.asignar(idIncidente, data);
      await Promise.all([
        cargarDetalle(idIncidente),
        cargarResumen(),
        cargarReferencias(),
      ]);
      notify('Brigada asignada al incidente');
    });
  }

  async function handleCambiarEstadoBrigada(idIncidente, idBrigada, estado) {
    await run(async () => {
      await despachoBrigadasService.cambiarEstado(idIncidente, idBrigada, estado);
      await Promise.all([
        cargarDetalle(idIncidente),
        cargarResumen(),
        cargarReferencias(),
        cargarDatosBrigadaBombero(),
      ]);
      notify(`Estado de brigada actualizado a ${estado}`);
    });
  }

  async function handleConfirmarRecepcionBrigada(idIncidente, idBrigada) {
    await run(async () => {
      const resp = await brigadasService.confirmarRecepcion(idIncidente, idBrigada);
      await Promise.all([
        cargarDetalle(idIncidente),
        cargarResumen(),
        cargarReferencias(),
        cargarDatosBrigadaBombero(),
      ]);
      notify(resp?.mensaje || 'Recepción confirmada: la brigada quedó en camino');
    });
  }

  async function handleDespacharCombo(idIncidente, brigada, unidad, ubicacionInc) {
    await run(async () => {
      await despachoBrigadasService.asignar(idIncidente, {
        id_brigada: brigada.id_brigada,
      });
      if (unidad) {
        const motivo = `Despachada a Incidente #${idIncidente} — ${
          ubicacionInc || 'Emergencia activa'
        }`;
        await estacionesService.cambiarEstado(
          'unidad',
          unidad.id_registro,
          'EN_MISION',
          motivo
        );
      }
      await Promise.all([
        cargarDetalle(idIncidente),
        cargarResumen(),
        cargarReferencias(),
        cargarEstaciones(),
      ]);
      notify(
        unidad
          ? `Brigada ${brigada.nombre} + Unidad ${unidad.codigo} despachadas al Incidente #${idIncidente}`
          : `Brigada ${brigada.nombre} despachada al Incidente #${idIncidente}`
      );
    });
  }

  async function handleDespacharUnidad(idIncidente, unidad, ubicacionInc) {
    await run(async () => {
      const motivo = `Despachada a Incidente #${idIncidente} — ${ubicacionInc || 'Emergencia activa'}`;
      await estacionesService.cambiarEstado(
        'unidad',
        unidad.id_registro,
        'EN_MISION',
        motivo
      );
      await cargarEstaciones();
      notify(`Unidad ${unidad.codigo} despachada al Incidente #${idIncidente}`);
    });
  }

  async function handleRetornarUnidad(idIncidente, unidad) {
    await run(async () => {
      await estacionesService.cambiarEstado(
        'unidad',
        unidad.id_registro,
        'DISPONIBLE',
        `Retornó a base desde Incidente #${idIncidente}`
      );
      await cargarEstaciones();
      notify(`Unidad ${unidad.codigo} retornada a base`);
    });
  }

  async function handleMovilizarRecurso(idIncidente, recurso, ubicacionInc) {
    await run(async () => {
      const motivo = `Asignado a Incidente #${idIncidente} — ${ubicacionInc || 'Emergencia activa'}`;
      await estacionesService.cambiarEstado(
        'recurso',
        recurso.id_registro,
        'EN_USO',
        motivo
      );
      await cargarEstaciones();
      notify(`Recurso "${recurso.nombre}" movilizado al Incidente #${idIncidente}`);
    });
  }

  async function handleLiberarRecurso(idIncidente, recurso) {
    await run(async () => {
      await estacionesService.cambiarEstado(
        'recurso',
        recurso.id_registro,
        'DISPONIBLE',
        `Liberado desde Incidente #${idIncidente}`
      );
      await cargarEstaciones();
      notify(`Recurso "${recurso.nombre}" liberado y disponible`);
    });
  }

  async function handleCrearInforme(idIncidente, data) {
    await run(async () => {
      await informesBomberoService.crear(idIncidente, data);
      await Promise.all([cargarDetalle(idIncidente), cargarResumen()]);
      notify('Informe de bombero registrado');
    });
  }

  async function handleGuardarEvaluacion(idIncidente, data, existe) {
    await run(async () => {
      if (existe) {
        await evaluacionDanosService.actualizar(idIncidente, data);
      } else {
        await evaluacionDanosService.crear(idIncidente, data);
      }
      await Promise.all([cargarDetalle(idIncidente), cargarResumen()]);
      notify('Evaluación de daños guardada');
    });
  }

  async function handleAbrirExpediente(idIncidente) {
    await run(async () => {
      const res = await incidentesService.expediente(idIncidente);
      setExpedienteActivo(res.data);
    });
  }

  const operadores = referencias.personas.filter(
    (p) => p.tipo_persona === 'OPERADOR' || p.tipo_persona === 'ADMINISTRADOR'
  );
  const listaOperadores =
    operadores.length > 0 ? operadores : referencias.personas;

  const zonaNombreById = useMemo(
    () => new Map((referencias.zonas || []).map((z) => [z.id_zona, `${z.nombre} (${z.nivel_riesgo})`])),
    [referencias.zonas]
  );

  const personaNombreById = useMemo(
    () => new Map((referencias.personas || []).map((p) => [p.id_persona, p.nombre_completo])),
    [referencias.personas]
  );

  const hayFiltrosIncidente = Boolean(
    busqueda.trim() || filtroIncidente || filtroGravedad || filtroZona
  );

  const incidentesFiltrados = incidentes.filter((inc) => {
    if (filtroZona && String(inc.id_zona || '') !== String(filtroZona)) {
      return false;
    }
    if (!busqueda.trim()) return true;
    const term = busqueda.trim().toLowerCase();
    const cleanId = term.replace(/^#/, '');
    const zonaTxt = (zonaNombreById.get(inc.id_zona) || '').toLowerCase();
    return (
      inc.ubicacion.toLowerCase().includes(term) ||
      zonaTxt.includes(term) ||
      String(inc.id_incidente) === cleanId
    );
  });

  const incidenteSeleccionado =
    incidentes.find((i) => i.id_incidente === selectedId) || null;

  const puedeCrearIncidenteDirecto =
    rolActivo === 'OPERADOR' || rolActivo === 'ADMIN';

  const ultimoAvisoCiudadano =
    misAvisos.find((a) => a.id_aviso === ultimoAvisoCiudadanoId) || null;
  const ultimoAvisoLat = ultimoAvisoCiudadano?.coordenadas?.lat ?? null;
  const ultimoAvisoLng = ultimoAvisoCiudadano?.coordenadas?.lng ?? null;

  useEffect(() => {
    const puntoConsulta =
      pickedPoint ||
      (esCiudadano && ultimoAvisoLat !== null && ultimoAvisoLng !== null
        ? { lat: ultimoAvisoLat, lng: ultimoAvisoLng }
        : null);

    if (!puntoConsulta) {
      setAvisosCercanos([]);
      return;
    }

    avisosService
      .cercanos(puntoConsulta.lat, puntoConsulta.lng, esCiudadano ? 2 : 3)
      .then((res) => setAvisosCercanos(res.data || []))
      .catch(() => setAvisosCercanos([]));
  }, [pickedPoint, esCiudadano, ultimoAvisoLat, ultimoAvisoLng]);

  const avisosPendientes = avisos.filter(
    (a) => a.estado_aviso === 'PENDIENTE' || a.estado_aviso === 'VERIFICADO'
  );
  const alertasCriticas = avisosPendientes.filter(
    (a) =>
      a.alerta_sla ||
      a.nivel_urgencia === 'CRITICO' ||
      a.nivel_urgencia === 'ALTO'
  );
  const incidentesActivosLista = incidentes.filter((i) => i.estado !== 'CERRADO');

  const kpisRecursos = useMemo(() => {
    const lista = Array.isArray(estaciones) ? estaciones : [];
    const totalUnidades = lista.reduce((acc, e) => acc + (e.unidades?.length || 0), 0);
    const unidadesEnBase = lista.reduce(
      (acc, e) =>
        acc + (e.unidades || []).filter((u) => u.estado === 'DISPONIBLE').length,
      0
    );
    const unidadesEnRuta = lista.reduce(
      (acc, e) =>
        acc + (e.unidades || []).filter((u) => u.estado === 'EN_MISION').length,
      0
    );
    const recursosDisponibles = lista.reduce(
      (acc, e) =>
        acc +
        (e.recursos || [])
          .filter((r) => r.estado === 'DISPONIBLE')
          .reduce((s, r) => s + Number(r.cantidad || 0), 0),
      0
    );
    return {
      estaciones: lista.length,
      totalUnidades,
      unidadesEnBase,
      unidadesEnRuta,
      recursosDisponibles,
    };
  }, [estaciones]);

  const badgeMapa = alertasCriticas.length || incidentesActivosLista.length || null;
  const badgeAvisos = avisosPendientes.length || null;
  const badgeIncidentes = incidentes.length || null;
  const badgeDetalle = incidenteSeleccionado
    ? `#${incidenteSeleccionado.id_incidente}`
    : null;

  useEffect(() => {
    setNavBadges({
      mapa_alertas: badgeMapa,
      avisos: badgeAvisos,
      incidentes: badgeIncidentes,
      detalle: badgeDetalle,
    });
  }, [badgeMapa, badgeAvisos, badgeIncidentes, badgeDetalle, setNavBadges]);

  return (
    <MainLayout>
      <div className="page-container">
      {(error || notice) && (
        <div className="inc-toast-stack no-print" aria-live="polite">
          {error && (
            <div className="inc-toast is-error" role="alert">
              <span className="inc-toast-icon" aria-hidden="true">⚠</span>
              <span className="inc-toast-msg">{error}</span>
              <button
                type="button"
                className="inc-toast-close"
                onClick={() => setError('')}
                aria-label="Cerrar notificación de error"
              >
                ✕
              </button>
            </div>
          )}
          {notice && (
            <div className="inc-toast is-success" role="status">
              <span className="inc-toast-icon" aria-hidden="true">✓</span>
              <span className="inc-toast-msg">{notice}</span>
              <button
                type="button"
                className="inc-toast-close"
                onClick={() => setNotice('')}
                aria-label="Cerrar notificación"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {!esCiudadano && alertaEntrante && (
        <div className="sos-incoming-banner no-print" role="alert">
          <div>
            <strong>
              🚨 NUEVA ALERTA SOS PRIORITARIA (#{alertaEntrante.id_aviso} —{' '}
              {alertaEntrante.nivel_urgencia})
            </strong>
            <div className="sos-incoming-sub">
              {alertaEntrante.ubicacion}
              {alertaEntrante.descripcion ? ` · ${alertaEntrante.descripcion}` : ''}
            </div>
          </div>
          <div className="item-actions">
            {alertaEntrante.coordenadas && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setPickedPoint(alertaEntrante.coordenadas);
                  setVistaActiva('mapa_alertas');
                }}
              >
                📍 Ver en Mapa
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setObjetivoValidacion({ tipo: 'aviso', aviso: alertaEntrante });
                setAlertaEntrante(null);
              }}
              disabled={loading}
            >
              Validar y Abrir Incidente
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setAlertaEntrante(null)}
            >
              Descartar banner
            </button>
          </div>
        </div>
      )}

      {esCiudadano ? (
        <div className="no-print">
          <CiudadanoPortal
            zonas={referencias.zonas}
            avisoActivo={ultimoAvisoCiudadano}
            misAvisos={misAvisos}
            avisosCercanos={avisosCercanos}
            usuarioAutenticado={usuarioAutenticado}
            pickedPoint={pickedPoint}
            onGpsCaptured={setPickedPoint}
            onIniciarReporteSos={handleCrearAviso}
            onAdjuntarFoto={(idAviso, foto) =>
              handleEnviarDescripcionIncendio(idAviso, { foto })
            }
            onEnviarDescripcion={handleEnviarDescripcionIncendio}
            onSeleccionarAviso={(idAviso) => {
              setPickedPoint(null);
              setUltimoAvisoCiudadanoId(idAviso);
            }}
            onNuevoReporte={() => {
              setPickedPoint(null);
              setUltimoAvisoCiudadanoId(null);
            }}
            loading={loading}
          />
        </div>
      ) : (
      <>
        {vistaActiva === 'mapa_alertas' ? (
          <>
            <div className="re-kpis inc-kpis-bar no-print">
              <button
                type="button"
                className="re-kpi re-kpi-oscuro inc-kpi-clickable"
                onClick={() => setVistaActiva('incidentes')}
                title="Ir a Gestión de Incidentes"
              >
                <span className="re-kpi-icono">
                  <Icono nombre="incidente" tamano={20} />
                </span>
                <span>
                  <strong>{incidentesActivosLista.length}</strong>
                  <small>Incidentes activos →</small>
                </span>
              </button>

              {rolActivo !== 'BOMBERO' ? (
                <button
                  type="button"
                  className="re-kpi inc-kpi-clickable"
                  onClick={() => setVistaActiva('avisos')}
                  title="Ir a Consola de Triage de Avisos"
                >
                  <span className="re-kpi-icono">
                    <Icono nombre="alerta" tamano={20} />
                  </span>
                  <span>
                    <strong>{avisosPendientes.length}</strong>
                    <small>
                      Alertas en triage
                      {(resumen?.alertas_sla_activas ?? 0) > 0
                        ? ` · ${resumen.alertas_sla_activas} SLA`
                        : ' →'}
                    </small>
                  </span>
                </button>
              ) : (
                <div className="re-kpi">
                  <span className="re-kpi-icono">
                    <Icono nombre="alerta" tamano={20} />
                  </span>
                  <span>
                    <strong>{avisosPendientes.length}</strong>
                    <small>
                      Alertas en triage
                      {(resumen?.alertas_sla_activas ?? 0) > 0
                        ? ` · ${resumen.alertas_sla_activas} SLA`
                        : ''}
                    </small>
                  </span>
                </div>
              )}

              <div className="re-kpi re-kpi-dorado">
                <span className="re-kpi-icono">
                  <Icono nombre="automovil" tamano={20} />
                </span>
                <span>
                  <strong>
                    {kpisRecursos.unidadesEnBase}/{kpisRecursos.totalUnidades}
                  </strong>
                  <small>
                    Unidades en base
                    {kpisRecursos.unidadesEnRuta > 0
                      ? ` · ${kpisRecursos.unidadesEnRuta} en ruta`
                      : ''}
                  </small>
                </span>
              </div>

              <div className="re-kpi">
                <span className="re-kpi-icono">
                  <Icono nombre="estacion" tamano={20} />
                </span>
                <span>
                  <strong>{kpisRecursos.estaciones}</strong>
                  <small>
                    Estaciones · {kpisRecursos.recursosDisponibles} rec. disp.
                  </small>
                </span>
              </div>
            </div>

            <div className="inc-ops-strip no-print">
              <div className="inc-ops-metrics">
                <button
                  type="button"
                  className="inc-compact-chip"
                  onClick={() => navigate('/brigadas')}
                  title="Abrir módulo de Brigadas"
                >
                  🚒 Brigadas disp. / desp.:{' '}
                  <strong>
                    {resumen?.brigadas_disponibles ?? 0} / {resumen?.brigadas_desplegadas ?? 0}
                  </strong>{' '}
                  ↗
                </button>
                <button
                  type="button"
                  className="inc-compact-chip"
                  onClick={() => navigate('/zonas-riesgo')}
                  title="Abrir módulo de Zonas de Riesgo"
                >
                  🌲 Zonas críticas:{' '}
                  <strong>{resumen?.zonas_criticas ?? 0}</strong>{' '}
                  ↗
                </button>
                <span>
                  Daños estimados:{' '}
                  <strong>
                    Bs. {Number(resumen?.costo_danos_estimado_total ?? 0).toLocaleString()}
                  </strong>
                </span>
              </div>
              <div className="inc-ops-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const next = !sonidoAlertaActivo;
                    setSonidoAlertaActivo(next);
                    if (next) reproducirTonoAlertaCad();
                  }}
                >
                  {sonidoAlertaActivo ? '🔊 Sonido CAD: Activo' : '🔇 Sonido CAD: Silenciado'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="inc-compact-bar no-print">
            <div className="inc-compact-chips">
              <button
                type="button"
                className="inc-compact-chip"
                onClick={() => setVistaActiva('incidentes')}
              >
                🔥 <strong>{incidentesActivosLista.length}</strong> incidentes activos
              </button>
              {rolActivo !== 'BOMBERO' && (
                <button
                  type="button"
                  className="inc-compact-chip"
                  onClick={() => setVistaActiva('avisos')}
                >
                  📢 <strong>{avisosPendientes.length}</strong> alertas en triage
                </button>
              )}
              <button
                type="button"
                className="inc-compact-chip"
                onClick={() => navigate('/brigadas')}
                title="Abrir módulo de Brigadas"
              >
                🚒 <strong>{resumen?.brigadas_disponibles ?? 0}</strong> brigadas disp. ↗
              </button>
              <button
                type="button"
                className="inc-compact-chip"
                onClick={() => navigate('/zonas-riesgo')}
                title="Abrir módulo de Zonas de Riesgo"
              >
                🌲 <strong>{resumen?.zonas_criticas ?? 0}</strong> zonas crít. ↗
              </button>
            </div>
            <button
              type="button"
              className="btn-secondary btn-xs"
              onClick={() => {
                const next = !sonidoAlertaActivo;
                setSonidoAlertaActivo(next);
                if (next) reproducirTonoAlertaCad();
              }}
            >
              {sonidoAlertaActivo ? '🔊 Sonido CAD' : '🔇 Silenciado'}
            </button>
          </div>
        )}

        {esBomberoReal &&
          (() => {
            const notifsPendientes = notificacionesBrigada.filter(
              (n) => n.estado === 'PENDIENTE'
            );
            const asignacionesActivas = misIncendiosBrigada.filter(
              (a) => a.estado_asignacion !== 'LIBERADA'
            );
            if (notifsPendientes.length === 0 && asignacionesActivas.length === 0) {
              return null;
            }
            return (
              <section
                className="inc-brigada-bombero-panel no-print"
                aria-label="Centro de guardia de brigada"
              >
                <div className="inc-brigada-bombero-head">
                  <strong>🛡️ Mi Guardia y Despachos de Brigada</strong>
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    onClick={() => navigate('/brigadas/incendios')}
                  >
                    Ver en módulo de Brigadas ↗
                  </button>
                </div>

                {notifsPendientes.length > 0 && (
                  <div className="inc-bombero-notif-alert" role="status">
                    <span>
                      📩 Tienes <strong>{notifsPendientes.length}</strong> invitación(es) pendiente(s) para unirte a una brigada.
                    </span>
                    <button
                      type="button"
                      className="btn-xs"
                      onClick={() => navigate('/brigadas')}
                    >
                      Responder en Brigadas →
                    </button>
                  </div>
                )}

                {asignacionesActivas.map((asig) => {
                  const estAsig = estadoAsignacion(asig.estado_asignacion);
                  return (
                    <div
                      key={`${asig.id_incidente}-${asig.id_brigada}`}
                      className="inc-bombero-asig-row"
                    >
                      <div>
                        <strong>Incidente #{asig.id_incidente}</strong> —{' '}
                        {asig.ubicacion || 'Ubicación registrada'}{' '}
                        <span className={`re-estado bg-estado-${estAsig.clase}`}>
                          <i className="vg-punto" /> {estAsig.etiqueta}
                        </span>
                        <div className="inc-brigada-meta">
                          <span>Brigada: {asig.brigada}</span>
                          {asig.gravedad && <span> · Gravedad: {asig.gravedad}</span>}
                        </div>
                      </div>
                      <div className="item-actions">
                        {asig.estado_asignacion === 'ASIGNADA' && (
                          <button
                            type="button"
                            onClick={() =>
                              handleConfirmarRecepcionBrigada(
                                asig.id_incidente,
                                asig.id_brigada
                              )
                            }
                            disabled={loading}
                          >
                            ✓ Confirmar recepción
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setSelectedId(asig.id_incidente);
                            setVistaActiva('detalle');
                          }}
                        >
                          Abrir Caso →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })()}

        <div className="module-content">
          {!esCiudadano && vistaActiva === 'mapa_alertas' && (
            <div className="view-stack no-print">
              <TacticalMap
                zonas={referencias.zonas}
                avisos={avisos}
                gruposTriangulados={gruposTriangulados}
                incidentes={incidentes}
                informes={informes}
                firmsData={firmsData}
                capaSatelitalActiva={capaSatelitalActiva}
                firmsSimulado={firmsSimulado}
                firmsDays={firmsDays}
                selectedIncidenteId={selectedId}
                pickedPoint={pickedPoint}
                onSelectIncidente={(id) => {
                  setSelectedId(id);
                }}
                onPickPoint={setPickedPoint}
                onToggleCapaSatelital={handleToggleCapaSatelital}
                onToggleSimulacionFirms={handleToggleSimulacionFirms}
                onRefrescarFirms={handleRefrescarFirms}
                onCambiarDiasFirms={handleCambiarDiasFirms}
                onCrearAvisoDesdeSatelite={
                  rolActivo !== 'BOMBERO' ? handleCrearAvisoDesdeSatelite : undefined
                }
                onSimularDiezAlarmas={
                  rolActivo !== 'BOMBERO' ? handleSimularDiezAlarmasZona : undefined
                }
                onConsolidarGrupo={
                  rolActivo !== 'BOMBERO'
                    ? (grupo) => setObjetivoValidacion({ tipo: 'grupo', grupo })
                    : undefined
                }
                onVerificarAviso={
                  rolActivo !== 'BOMBERO'
                    ? (idAviso) => handleCambiarEstadoAviso(idAviso, 'VERIFICADO')
                    : undefined
                }
                onConvertirAviso={
                  rolActivo !== 'BOMBERO'
                    ? (aviso) => setObjetivoValidacion({ tipo: 'aviso', aviso })
                    : undefined
                }
                onGestionarIncidente={(id) => {
                  setSelectedId(id);
                  setVistaActiva('detalle');
                }}
                loading={loading}
                modoCiudadano={false}
              />

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>📐 Agrupación y Triangulación de Alarmas por Zona ({gruposTriangulados.length})</h2>
                    <p className="subtitle">
                      Cuando múltiples llamados provienen de ubicaciones cercanas (≤ 2.5 km), se triangula su centroide ponderado y se agrupan para abrir un único incidente.
                    </p>
                  </div>
                  {rolActivo !== 'BOMBERO' && (
                    <div className="item-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleSimularDiezAlarmasZona}
                        disabled={loading}
                      >
                        🧪 Simular 10 Alarmas en Zona
                      </button>
                    </div>
                  )}
                </div>

                {gruposTriangulados.length === 0 ? (
                  <p className="empty-text">
                    No hay múltiples alarmas concentradas en una misma zona en este momento.
                  </p>
                ) : (
                  <div className="list-stack">
                    {gruposTriangulados.map((grp) => (
                      <article key={grp.id_grupo} className="item-row cluster-row">
                        <div className="item-main">
                          <div className="item-title">
                            <strong>
                              🎯 Grupo Triangulado #{grp.id_grupo} — {grp.cantidad_avisos} llamados agrupados
                            </strong>{' '}
                            ({grp.zona_sugerida?.nombre || 'Sector detectado por GPS'})
                          </div>
                          <p className="item-desc">
                            Centroide triangulado:{' '}
                            <b>
                              {grp.centroide.lat}, {grp.centroide.lng}
                            </b>{' '}
                            · Dispersión: <b>±{grp.radio_dispersion_km} km</b> · Avisos incluidos:{' '}
                            {grp.ids_avisos.map((id) => `#${id}`).join(', ')}
                          </p>
                          <div className="item-meta">
                            <StatusBadge value={grp.nivel_urgencia_max} />
                            <StatusBadge value={grp.gravedad_sugerida} />
                          </div>
                        </div>
                        <div className="item-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setPickedPoint(grp.centroide)}
                          >
                            📍 Ver Triangulación
                          </button>
                          {rolActivo !== 'BOMBERO' && (
                            <button
                              type="button"
                              onClick={() => setObjetivoValidacion({ tipo: 'grupo', grupo: grp })}
                              disabled={loading}
                            >
                              ⚡ Consolidar {grp.cantidad_avisos} en 1 Incidente
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>Alertas y Eventos Activos en Tiempo Real</h2>
                    <p className="subtitle">
                      Resumen rápido de emergencias activas. Usa el menú izquierdo o los botones para profundizar.
                    </p>
                  </div>
                  <div className="item-actions">
                    {rolActivo !== 'BOMBERO' && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setVistaActiva('avisos')}
                      >
                        📢 Ir a Triage ({avisosPendientes.length})
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setVistaActiva('incidentes')}
                    >
                      🔥 Ver Incidentes ({incidentes.length})
                    </button>
                  </div>
                </div>

                <div className="alerts-split-preview">
                  <div className="subpanel">
                    <h3>🚨 Alertas Ciudadanas Pendientes ({avisosPendientes.length})</h3>
                    <div className="list-stack">
                      {avisosPendientes.length === 0 ? (
                        <p className="empty-text">Sin alertas ciudadanas pendientes.</p>
                      ) : (
                        avisosPendientes.slice(0, 5).map((av) => (
                          <article key={av.id_aviso} className="item-row compact">
                            <div className="item-main">
                              <div className="item-title">
                                <strong>Aviso #{av.id_aviso}</strong> — {av.ubicacion}
                              </div>
                              <div className="item-meta">
                                <StatusBadge value={av.nivel_urgencia} />
                                <StatusBadge value={av.estado_aviso} />
                                {av.alerta_sla && (
                                  <span className="badge badge-danger">SLA &gt;15m</span>
                                )}
                              </div>
                            </div>
                            <div className="item-actions">
                              {av.coordenadas && (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => setPickedPoint(av.coordenadas)}
                                >
                                  📍 Mapa
                                </button>
                              )}
                              {rolActivo !== 'BOMBERO' && (
                                <button
                                  type="button"
                                  onClick={() => setVistaActiva('avisos')}
                                >
                                  Atender
                                </button>
                              )}
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="subpanel">
                    <h3>🔥 Incidentes en Curso ({incidentesActivosLista.length})</h3>
                    <div className="list-stack">
                      {incidentesActivosLista.length === 0 ? (
                        <p className="empty-text">No hay incidentes activos en este momento.</p>
                      ) : (
                        incidentesActivosLista.slice(0, 5).map((inc) => (
                          <article
                            key={inc.id_incidente}
                            className={`item-row compact ${
                              selectedId === inc.id_incidente ? 'selected' : ''
                            }`}
                          >
                            <div className="item-main">
                              <div className="item-title">
                                <strong>Incidente #{inc.id_incidente}</strong> — {inc.ubicacion}
                              </div>
                              <div className="item-meta">
                                <StatusBadge value={inc.gravedad} />
                                <StatusBadge value={inc.estado} />
                              </div>
                            </div>
                            <div className="item-actions">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedId(inc.id_incidente);
                                  setVistaActiva('detalle');
                                }}
                              >
                                Gestionar →
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {!esCiudadano && vistaActiva === 'avisos' && rolActivo !== 'BOMBERO' && (
            <div className="view-stack no-print">
              <AvisosPanel
                avisos={avisos}
                incidentesActivos={incidentes}
                focosSatelitales={firmsData?.focos || []}
                personas={referencias.personas}
                zonas={referencias.zonas}
                gruposTriangulados={gruposTriangulados}
                rolActivo={rolActivo}
                pickedPoint={pickedPoint}
                avisosCercanos={avisosCercanos}
                onGpsCaptured={setPickedPoint}
                onLimpiarPunto={() => setPickedPoint(null)}
                filtroEstado={filtroAviso}
                onFiltroChange={setFiltroAviso}
                onCrearAviso={handleCrearAviso}
                onCambiarEstado={handleCambiarEstadoAviso}
                onSolicitarDescarte={(aviso) => setAvisoADescartar(aviso)}
                onConvertirAIncidente={(aviso) =>
                  setObjetivoValidacion({ tipo: 'aviso', aviso })
                }
                onVincularAIncidente={async (aviso, inc) => {
                  await handleVincularAvisoAIncidente(aviso, inc);
                  setVistaActiva('detalle');
                }}
                onConsolidarGrupo={(grupo) =>
                  setObjetivoValidacion({ tipo: 'grupo', grupo })
                }
                onVerEnMapa={(coords) => {
                  setPickedPoint(coords);
                  setVistaActiva('mapa_alertas');
                }}
                loading={loading}
              />
            </div>
          )}

          {!esCiudadano && vistaActiva === 'incidentes' && (
            <div className="view-stack no-print">
              <section className="card">
                <div className="triage-header">
                  <div>
                    <h2>Gestión de Incidentes</h2>
                    <p className="subtitle">
                      Consulta el estado de los casos, filtra por zona o gravedad y accede al despacho o acta oficial.
                    </p>
                  </div>
                  {puedeCrearIncidenteDirecto && (
                    <button
                      type="button"
                      className={mostrarFormIncidente ? 'btn-secondary' : ''}
                      onClick={() => setMostrarFormIncidente((prev) => !prev)}
                    >
                      {mostrarFormIncidente
                        ? '✕ Cerrar Registro'
                        : '+ Registrar Incidente Directo'}
                    </button>
                  )}
                </div>

                {puedeCrearIncidenteDirecto && mostrarFormIncidente && (
                  <div className="triage-intake-card">
                    <div>
                      <strong>Registro Directo de Incidente</strong>
                      <p className="subtitle">
                        Abre un incidente operativo sin pasar por la cola de avisos ciudadanos.
                      </p>
                    </div>

                    <div className="triage-intake-group">
                      <span className="kpi-label">Gravedad inicial</span>
                      <div className="inc-gravity-pills" role="group" aria-label="Gravedad del incidente">
                        {GRAVEDADES.map((g) => (
                          <button
                            key={g}
                            type="button"
                            className={`inc-gravity-pill sev-${g.toLowerCase()} ${
                              gravedad === g ? 'active' : ''
                            }`}
                            onClick={() => setGravedad(g)}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <form className="triage-intake-form" onSubmit={handleCrearIncidenteDirecto}>
                      <div className="triage-intake-grid">
                        <input
                          type="text"
                          placeholder="Ubicación del incidente *"
                          value={ubicacion}
                          onChange={(e) => setUbicacion(e.target.value)}
                          required
                        />
                        <select value={idZona} onChange={(e) => setIdZona(e.target.value)}>
                          <option value="">Auto-detectar zona por coord.</option>
                          {referencias.zonas
                            .filter((z) => z.estado !== 'Inactiva')
                            .map((z) => (
                              <option key={z.id_zona} value={z.id_zona}>
                                {z.nombre} ({z.nivel_riesgo}
                                {z.estado === 'Alerta Emitida' ? ' · 🚨 Alerta COE' : ''})
                              </option>
                            ))}
                        </select>
                        <select
                          value={idOperador}
                          onChange={(e) => setIdOperador(e.target.value)}
                        >
                          <option value="">Operador (auto / opcional)</option>
                          {listaOperadores.map((p) => (
                            <option key={p.id_persona} value={p.id_persona}>
                              {p.nombre_completo} (#{p.id_persona})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="item-actions">
                        <button type="submit" disabled={loading}>
                          Crear Incidente
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setMostrarFormIncidente(false)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div
                  className="triage-state-pills"
                  role="tablist"
                  aria-label="Filtro rápido por estado"
                  style={{ marginTop: '0.85rem' }}
                >
                  {ESTADOS_FILTRO.map((est) => {
                    const conteo = est
                      ? resumen?.incidentes_por_estado?.[est] ?? 0
                      : Object.values(resumen?.incidentes_por_estado || {}).reduce(
                          (sum, val) => sum + Number(val || 0),
                          0
                        ) || incidentes.length;
                    return (
                      <button
                        key={est || 'ALL'}
                        type="button"
                        className={`triage-pill ${filtroIncidente === est ? 'active' : ''}`}
                        onClick={() => setFiltroIncidente(est)}
                      >
                        <span>{est || 'Todos'}</span>
                        <span className="triage-pill-count">{conteo}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="triage-toolbar">
                  <input
                    type="search"
                    className="triage-search-input"
                    placeholder="Buscar por #id, ubicación o zona..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    aria-label="Buscar incidente"
                  />
                  <select
                    value={filtroGravedad}
                    onChange={(e) => setFiltroGravedad(e.target.value)}
                    aria-label="Filtrar incidentes por gravedad"
                  >
                    <option value="">Todas las gravedades</option>
                    {GRAVEDADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filtroZona}
                    onChange={(e) => setFiltroZona(e.target.value)}
                    aria-label="Filtrar incidentes por zona"
                  >
                    <option value="">Todas las zonas</option>
                    {referencias.zonas.map((z) => (
                      <option key={z.id_zona} value={z.id_zona}>
                        {z.nombre} ({z.nivel_riesgo})
                      </option>
                    ))}
                  </select>
                  {hayFiltrosIncidente && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setBusqueda('');
                        setFiltroIncidente('');
                        setFiltroGravedad('');
                        setFiltroZona('');
                      }}
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>

                <div className="list-stack" style={{ marginTop: '0.85rem' }}>
                  {incidentesFiltrados.length === 0 ? (
                    <p className="empty-text">No hay incidentes registrados.</p>
                  ) : (
                    incidentesFiltrados.map((inc) => (
                      <article
                        key={inc.id_incidente}
                        className={`item-row selectable inc-list-card grav-${(
                          inc.gravedad || 'MEDIA'
                        ).toLowerCase()} ${
                          selectedId === inc.id_incidente ? 'selected' : ''
                        }`}
                        onClick={() => setSelectedId(inc.id_incidente)}
                      >
                        <div className="item-main">
                          <div className="item-title">
                            <strong>#{inc.id_incidente}</strong> — {inc.ubicacion}
                          </div>
                          <div className="item-meta">
                            <StatusBadge value={inc.gravedad} />
                            <StatusBadge value={inc.estado} />
                            <span className="badge badge-muted">
                              🗺️ {zonaNombreById.get(inc.id_zona) || 'Sin zona'}
                            </span>
                            {inc.id_operador && (
                              <span className="badge badge-muted">
                                👤 {personaNombreById.get(inc.id_operador) || `#${inc.id_operador}`}
                              </span>
                            )}
                            {inc.duracion_min != null && (
                              <span className="badge badge-muted">
                                ⏱ {inc.duracion_min} min
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="item-actions">
                          {inc.coordenadas && (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPickedPoint(inc.coordenadas);
                                setVistaActiva('mapa_alertas');
                              }}
                            >
                              📍 Mapa
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbrirExpediente(inc.id_incidente);
                            }}
                            disabled={loading}
                          >
                            Acta
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(inc.id_incidente);
                              setVistaActiva('detalle');
                            }}
                          >
                            Gestionar →
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}

          {!esCiudadano && vistaActiva === 'detalle' && (
            <div className="view-stack no-print">
              <div className="card detail-selector-bar">
                <span>Incidente en inspección:</span>
                <select
                  value={selectedId || ''}
                  onChange={(e) =>
                    setSelectedId(e.target.value ? Number(e.target.value) : null)
                  }
                  aria-label="Seleccionar incidente para ver detalle"
                >
                  <option value="">-- Selecciona un incidente --</option>
                  {incidentes.map((inc) => (
                    <option key={inc.id_incidente} value={inc.id_incidente}>
                      #{inc.id_incidente} — {inc.ubicacion} [{inc.estado} / {inc.gravedad}]
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setVistaActiva('mapa_alertas')}
                >
                  ← Volver a Mapa y Alertas
                </button>
              </div>

              <IncidenteDetallePanel
                incidente={incidenteSeleccionado}
                incidentes={incidentes}
                referencias={referencias}
                estaciones={estaciones}
                rolActivo={rolActivo}
                usuarioAutenticado={usuarioAutenticado}
                brigadas={brigadas}
                informes={informes}
                evaluacion={evaluacion}
                loading={loading}
                onSeleccionarIncidente={setSelectedId}
                onVerEnMapa={(coords) => {
                  setPickedPoint(coords);
                  setVistaActiva('mapa_alertas');
                }}
                onVolverAIncidentes={() => setVistaActiva('incidentes')}
                onConfirmarRecepcionBrigada={
                  esBomberoReal ? handleConfirmarRecepcionBrigada : undefined
                }
                onIrABrigadas={(ruta = '/brigadas') => navigate(ruta)}
                onIrAZonas={() => navigate('/zonas-riesgo')}
                onAbrirExpediente={handleAbrirExpediente}
                onAbrirEstacion={abrirEstacion}
                onActualizarIncidente={handleActualizarIncidente}
                onCambiarEstadoIncidente={handleCambiarEstadoIncidente}
                onCerrarIncidente={handleCerrarIncidente}
                onAsignarBrigada={handleAsignarBrigada}
                onCambiarEstadoBrigada={handleCambiarEstadoBrigada}
                onDespacharCombo={handleDespacharCombo}
                onDespacharUnidad={handleDespacharUnidad}
                onRetornarUnidad={handleRetornarUnidad}
                onMovilizarRecurso={handleMovilizarRecurso}
                onLiberarRecurso={handleLiberarRecurso}
                onCrearInforme={handleCrearInforme}
                onGuardarEvaluacion={handleGuardarEvaluacion}
              />
            </div>
          )}
        </div>
      </>
      )}

      {!esCiudadano && (
        <>
          <ValidarClasificarModal
            objetivo={objetivoValidacion}
            zonas={referencias.zonas}
            incidentesActivos={incidentes}
            focosSatelitales={firmsData?.focos || []}
            loading={loading}
            onClose={() => setObjetivoValidacion(null)}
            onConfirmarAbrir={async (clasificacion) => {
              if (!objetivoValidacion) return;
              if (objetivoValidacion.tipo === 'grupo') {
                await handleConsolidarGrupo(objetivoValidacion.grupo, clasificacion);
              } else {
                await handleConvertirAIncidente(objetivoValidacion.aviso, clasificacion);
              }
              setObjetivoValidacion(null);
              setVistaActiva('detalle');
            }}
            onConfirmarSoloVerificar={async (idAviso) => {
              await handleCambiarEstadoAviso(idAviso, 'VERIFICADO');
              setObjetivoValidacion(null);
            }}
            onVincularExistente={async (aviso, inc) => {
              await handleVincularAvisoAIncidente(aviso, inc);
              setObjetivoValidacion(null);
              setVistaActiva('detalle');
            }}
          />

          <DescartarAvisoModal
            aviso={avisoADescartar}
            loading={loading}
            onClose={() => setAvisoADescartar(null)}
            onConfirmarDescarte={async (idAviso, motivo) => {
              await handleCambiarEstadoAviso(idAviso, 'DESCARTADO', motivo);
              setAvisoADescartar(null);
            }}
          />

          <ExpedienteModal
            expediente={expedienteActivo}
            estaciones={estaciones}
            onClose={() => setExpedienteActivo(null)}
          />
        </>
      )}
      </div>
    </MainLayout>
  );
}
