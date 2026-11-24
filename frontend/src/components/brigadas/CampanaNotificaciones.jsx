import { useCallback, useEffect, useRef, useState } from "react";
import Icono from "../layout/IconosVigia";
import { estadoNotificacion } from "./estadosBrigada";
import * as brigadasService from "../../services/brigadasService";

export default function CampanaNotificaciones() {
  const [abierta, setAbierta] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [respondiendo, setRespondiendo] = useState(null);
  const [rechazando, setRechazando] = useState(null);
  const [motivos, setMotivos] = useState({});
  const contenedor = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setNotificaciones(await brigadasService.misNotificaciones());
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    function alHacerClic(evento) {
      if (contenedor.current && !contenedor.current.contains(evento.target)) {
        setAbierta(false);
      }
    }
    function alPulsar(evento) {
      if (evento.key === "Escape") setAbierta(false);
    }
    document.addEventListener("mousedown", alHacerClic);
    window.addEventListener("keydown", alPulsar);
    return () => {
      document.removeEventListener("mousedown", alHacerClic);
      window.removeEventListener("keydown", alPulsar);
    };
  }, []);

  async function responder(notificacion, respuesta) {
    setError("");
    setRespondiendo(notificacion.id_notificacion);
    try {
      await brigadasService.responderNotificacion(
        notificacion.id_notificacion,
        respuesta,
        motivos[notificacion.id_notificacion] || ""
      );
      setRechazando(null);
      await cargar();
      window.dispatchEvent(new CustomEvent("brigadas:notificacion-respondida"));
    } catch (err) {
      setError(err.message);
    } finally {
      setRespondiendo(null);
    }
  }

  const pendientes = notificaciones.filter(
    (notificacion) => notificacion.estado === "PENDIENTE"
  ).length;

  return (
    <div className="bg-campana" ref={contenedor}>
      <button
        type="button"
        className="bg-campana-boton"
        onClick={() => setAbierta(!abierta)}
        aria-label={`Notificaciones${pendientes ? `, ${pendientes} pendientes` : ""}`}
        aria-expanded={abierta}
        title="Notificaciones"
      >
        <Icono nombre="campana" tamano={20} />
        {pendientes > 0 && <span className="bg-campana-badge">{pendientes}</span>}
      </button>

      {abierta && (
        <div className="bg-campana-panel" role="dialog" aria-label="Mis notificaciones">
          <div className="bg-campana-cabecera">
            <strong>Notificaciones</strong>
            <button
              type="button"
              className="bg-campana-cerrar"
              onClick={() => setAbierta(false)}
              aria-label="Cerrar notificaciones"
            >
              <Icono nombre="cerrar" tamano={15} />
            </button>
          </div>

          {error && <p className="aviso">{error}</p>}
          {cargando && <p className="estado">Cargando notificaciones.</p>}
          {!cargando && notificaciones.length === 0 && (
            <p className="estado">No tienes notificaciones por ahora.</p>
          )}

          {!cargando && notificaciones.length > 0 && (
            <ul className="bg-campana-lista">
              {notificaciones.map((notificacion) => {
                const estado = estadoNotificacion(notificacion.estado);
                return (
                  <li className="bg-campana-item" key={notificacion.id_notificacion}>
                    <span className={`re-estado ${estado.clase} bg-campana-estado`}>
                      <i className="vg-punto" /> {estado.etiqueta}
                    </span>
                    <strong>{notificacion.mensaje}</strong>
                    <small>
                      {notificacion.brigada || "-"} · {notificacion.fecha_creacion?.slice(0, 10)}
                      {notificacion.motivo_rechazo ? ` · Motivo: ${notificacion.motivo_rechazo}` : ""}
                    </small>

                    {notificacion.estado === "PENDIENTE" && (
                      <div className="bg-campana-acciones">
                        <button
                          type="button"
                          className="vg-boton-principal"
                          disabled={respondiendo === notificacion.id_notificacion}
                          onClick={() => responder(notificacion, "ACEPTAR")}
                        >
                          Aceptar
                        </button>
                        <button
                          type="button"
                          className="vg-boton-secundario"
                          disabled={respondiendo === notificacion.id_notificacion}
                          onClick={() => setRechazando(notificacion.id_notificacion)}
                        >
                          Rechazar
                        </button>
                      </div>
                    )}

                    {rechazando === notificacion.id_notificacion && (
                      <div className="bg-campana-rechazo">
                        <label className="campo" htmlFor={`motivo-${notificacion.id_notificacion}`}>
                          <span>Motivo del rechazo (obligatorio)</span>
                          <textarea
                            id={`motivo-${notificacion.id_notificacion}`}
                            value={motivos[notificacion.id_notificacion] || ""}
                            onChange={(evento) =>
                              setMotivos((actual) => ({
                                ...actual,
                                [notificacion.id_notificacion]: evento.target.value,
                              }))
                            }
                            maxLength={500}
                            rows={2}
                            placeholder="Ej. No tengo tiempo disponible"
                          />
                        </label>
                        <div className="bg-campana-acciones">
                          <button
                            type="button"
                            className="boton boton-oscuro"
                            disabled={respondiendo === notificacion.id_notificacion}
                            onClick={() => responder(notificacion, "RECHAZAR")}
                          >
                            Enviar rechazo
                          </button>
                          <button type="button" className="boton" onClick={() => setRechazando(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
