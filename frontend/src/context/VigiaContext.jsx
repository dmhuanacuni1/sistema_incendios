import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { invalidarFotoEstacion } from "../components/recursos/ImagenEstacion";
import * as estacionesService from "../services/estacionesService";

const VigiaContext = createContext(null);

const ROLES_CON_ACCESO_A_RECURSOS = ["ADMINISTRADOR", "OPERADOR", "BOMBERO"];

export function VigiaProvider({ children }) {
  const [busqueda, setBusqueda] = useState("");
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [colapsado, setColapsado] = useState(false);

  const [estaciones, setEstaciones] = useState([]);
  const [cargandoEstaciones, setCargandoEstaciones] = useState(true);
  const [errorEstaciones, setErrorEstaciones] = useState("");
  const [idEstacionSeleccionada, setIdEstacionSeleccionada] = useState(null);

  const { usuario } = useAuth();
  const sesion = usuario?.nombre_usuario || "";
  const puedeVerRecursos = ROLES_CON_ACCESO_A_RECURSOS.includes(usuario?.rol);

  const estacionSeleccionada = useMemo(
    () => estaciones.find((estacion) => estacion.id_estacion === idEstacionSeleccionada) || null,
    [estaciones, idEstacionSeleccionada]
  );

  const cargarEstaciones = useCallback(async () => {
    setCargandoEstaciones(true);
    setErrorEstaciones("");
    try {
      const lista = await estacionesService.consultar();
      setEstaciones(Array.isArray(lista) ? lista : []);
    } catch (err) {
      setErrorEstaciones(err.message || "No se pudieron cargar las estaciones.");
    } finally {
      setCargandoEstaciones(false);
    }
  }, []);

  async function editarEstacion(idEstacion, datos) {
    try {
      const respuesta = await estacionesService.actualizar(idEstacion, datos);
      if (Object.prototype.hasOwnProperty.call(datos, "foto_url")) {
        invalidarFotoEstacion(idEstacion);
      }
      await cargarEstaciones();
      return {
        ok: true,
        mensaje: respuesta.mensaje || "Estación actualizada correctamente",
      };
    } catch (err) {
      return { ok: false, error: err.message || "No se pudo actualizar la estación." };
    }
  }

  async function cambiarEstadoEstacion(idEstacion, estado, motivoBaja = "") {
    try {
      const respuesta = await estacionesService.cambiarEstadoEstacion(
        idEstacion,
        estado,
        motivoBaja
      );
      await cargarEstaciones();
      return { ok: true, mensaje: respuesta.mensaje || "Estado actualizado" };
    } catch (err) {
      return { ok: false, error: err.message || "No se pudo cambiar el estado." };
    }
  }

  useEffect(() => {
    if (!sesion || !puedeVerRecursos) {
      setEstaciones([]);
      setCargandoEstaciones(false);
      return;
    }
    cargarEstaciones();
  }, [sesion, puedeVerRecursos, cargarEstaciones]);

  function cambiarEstadoUnidad(idEstacion, idUnidad, estado) {
    setEstaciones((actuales) =>
      actuales.map((estacion) =>
        estacion.id_estacion === idEstacion
          ? {
              ...estacion,
              unidades: estacion.unidades.map((unidad) =>
                (unidad.id_unidad ?? unidad.id) === idUnidad ? { ...unidad, estado } : unidad
              ),
            }
          : estacion
      )
    );
  }

  function ajustarRecurso(idEstacion, idRecurso, delta) {
    setEstaciones((actuales) =>
      actuales.map((estacion) =>
        estacion.id_estacion === idEstacion
          ? {
              ...estacion,
              recursos: estacion.recursos.map((recurso) =>
                (recurso.id_recurso ?? recurso.id) === idRecurso
                  ? { ...recurso, cantidad: Math.max(0, Number(recurso.cantidad || 0) + delta) }
                  : recurso
              ),
            }
          : estacion
      )
    );
  }

  function asignarIncidente(idEstacion, idIncidente) {
    const estacion = estaciones.find((item) => item.id_estacion === idEstacion);
    if (!estacion) {
      return { ok: false, mensaje: "No se encontró la estación seleccionada." };
    }

    const tieneUnidades = estacion.unidades.length > 0;
    const tieneRecursos = estacion.recursos.some(
      (recurso) => Number(recurso.cantidad) > 0
    );
    if (!tieneUnidades && !tieneRecursos) {
      return {
        ok: false,
        mensaje:
          "Esta estación no puede asignarse: registra al menos una unidad o un recurso con cantidad mayor a 0.",
      };
    }

    setEstaciones((actuales) =>
      actuales.map((item) =>
        item.id_estacion === idEstacion
          ? { ...item, incidenteAsignado: idIncidente }
          : item
      )
    );
    return { ok: true, mensaje: "Estación asignada al incidente." };
  }

  useEffect(() => {
    function alPulsar(evento) {
      if (evento.key !== "Escape") return;
      setIdEstacionSeleccionada(null);
      setSidebarAbierto(false);
    }
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  useEffect(() => {
    const bloqueado = Boolean(idEstacionSeleccionada) || sidebarAbierto;
    document.body.style.overflow = bloqueado ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [idEstacionSeleccionada, sidebarAbierto]);

  const valor = useMemo(
    () => ({
      estaciones,
      cargandoEstaciones,
      errorEstaciones,
      estacionSeleccionada,
      abrirEstacion: setIdEstacionSeleccionada,
      cerrarEstacion: () => setIdEstacionSeleccionada(null),
      cargarEstaciones,
      editarEstacion,
      cambiarEstadoEstacion,
      cambiarEstadoUnidad,
      ajustarRecurso,
      asignarIncidente,
      busqueda,
      setBusqueda,
      sidebarAbierto,
      setSidebarAbierto,
      colapsado,
      setColapsado,
    }),
    [
      estaciones,
      cargandoEstaciones,
      errorEstaciones,
      estacionSeleccionada,
      cargarEstaciones,
      busqueda,
      sidebarAbierto,
      colapsado,
    ]
  );

  return <VigiaContext.Provider value={valor}>{children}</VigiaContext.Provider>;
}

export function useVigia() {
  const contexto = useContext(VigiaContext);
  if (!contexto) throw new Error("useVigia debe usarse dentro de VigiaProvider");
  return contexto;
}
