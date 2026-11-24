import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Icono from "./IconosVigia";
import { obtenerMisAlertas, confirmarAlerta } from "../../services/alertasService";
import { useOperacion } from "../../context/OperacionContext";
import { useAuth } from "../../hooks/useAuth";

const sonidoAlerta = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");

export default function NotificationBell() {
  const [alertas, setAlertas] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const refMenu = useRef(null);
  const [cantidadAnterior, setCantidadAnterior] = useState(0);
  
  const navigate = useNavigate();
  const { setVistaIncidente } = useOperacion(); // Para cambiar la pestaña en /incidentes
  const { usuario } = useAuth();

  const cargarAlertas = async () => {
    try {
      const data = await obtenerMisAlertas();
      const noConfirmadas = data.filter((a) => !a.confirmada);
      
      if (noConfirmadas.length > cantidadAnterior) {
        sonidoAlerta.play().catch(() => console.log("Audio bloqueado por el navegador"));
      }
      
      setCantidadAnterior(noConfirmadas.length);
      setAlertas(noConfirmadas);
    } catch (error) {
      console.error("Error al cargar alertas", error);
    }
  };

  useEffect(() => {
    cargarAlertas();
    const intervalo = setInterval(cargarAlertas, 15000); 
    return () => clearInterval(intervalo);
  }, [cantidadAnterior]);

  useEffect(() => {
    function manejarClicFuera(evento) {
      if (refMenu.current && !refMenu.current.contains(evento.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", manejarClicFuera);
    return () => document.removeEventListener("mousedown", manejarClicFuera);
  }, []);

  const handleConfirmar = async (e, id) => {
    e.stopPropagation(); // Evita que al confirmar se dispare también la redirección
    try {
      await confirmarAlerta(id);
      cargarAlertas();
    } catch (error) {
      console.error("Error al confirmar", error);
    }
  };

  // FUNCIÓN PARA REDIRIGIR
  const handleRedirigir = (alerta) => {
    setAbierto(false); // Cerramos el menú

    // Si es un ciudadano, lo mandamos a su historial
    if (usuario?.rol === "CIUDADANO") {
      navigate("/mis-alertas");
      return;
    }

    // Para operadores y administradores:
    // Intentamos extraer el número de aviso del mensaje (ej: "(Aviso #24)")
    const matchAviso = alerta.mensaje.match(/Aviso #(\d+)/);
    if (matchAviso && matchAviso[1]) {
      const idAviso = matchAviso[1];
      setVistaIncidente("avisos"); // Cambia la pestaña interna a Triage de Avisos
      // Navega a incidentes pasando el ID en el estado (state)
      navigate("/incidentes", { state: { avisoSeleccionadoId: idAviso } });
      return;
    }

    // Si es una alerta de incidente (tiene id_incidente)
    if (alerta.id_incidente) {
      setVistaIncidente("detalle");
      navigate("/incidentes", { state: { incidenteSeleccionadoId: alerta.id_incidente } });
      return;
    }

    // Fallback: ir a la vista general de incidentes
    navigate("/incidentes");
  };

  return (
    <div className="relative" ref={refMenu} style={{ position: "relative" }}>
      <button
        type="button"
        style={{ 
          color: alertas.length > 0 ? "#e53e3e" : "#2d3748", 
          background: "none", border: "none", cursor: "pointer",
          position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px"
        }}
        onClick={() => setAbierto(!abierto)}
        aria-label="Notificaciones"
      >
        <Icono nombre="campana" tamano={24} />
        {alertas.length > 0 && (
          <span style={{
              position: "absolute", top: "2px", right: "2px", 
              backgroundColor: "#e53e3e", color: "white", 
              fontSize: "10px", fontWeight: "bold", 
              borderRadius: "50%", padding: "2px 5px", border: "2px solid white"
          }}>
            {alertas.length}
          </span>
        )}
      </button>

      {abierto && (
        <div style={{
            position: "absolute", right: 0, top: "120%", width: "340px",
            backgroundColor: "white", boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            borderRadius: "8px", zIndex: 1000, maxHeight: "400px", overflowY: "auto",
            border: "1px solid #e2e8f0"
        }}>
          <div style={{ padding: "12px", borderBottom: "1px solid #eee", fontWeight: "bold" }}>
            Alertas Recientes
          </div>
          {alertas.length === 0 ? (
            <div style={{ padding: "16px", textAlign: "center", color: "#718096", fontSize: "14px" }}>
              No hay alertas pendientes
            </div>
          ) : (
            alertas.map((alerta) => {
              const esRoja = alerta.tipo.includes("ROJA");
              const esAmarilla = alerta.tipo.includes("AMARILLA");
              const esVerde = alerta.tipo.includes("VERDE");
              
              const bgColor = esRoja ? "#fff5f5" : esAmarilla ? "#fffff0" : esVerde ? "#f0fff4" : "#fff";
              const textColor = esRoja ? "#c53030" : esAmarilla ? "#b7791f" : esVerde ? "#2f855a" : "#2d3748";

              return (
                <div 
                  key={alerta.id_alerta} 
                  onClick={() => handleRedirigir(alerta)}
                  style={{ 
                    padding: "12px", borderBottom: "1px solid #eee", backgroundColor: bgColor,
                    cursor: "pointer", transition: "filter 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(0.95)"}
                  onMouseLeave={(e) => e.currentTarget.style.filter = "brightness(1)"}
                  title="Haz clic para ver los detalles"
                >
                  <p style={{ fontSize: "12px", fontWeight: "bold", color: textColor, margin: 0 }}>
                    {alerta.tipo}
                  </p>
                  <p style={{ fontSize: "13px", color: "#4a5568", margin: "4px 0" }}>
                    {alerta.mensaje}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#a0aec0" }}>
                      {new Date(alerta.fecha).toLocaleTimeString()}
                    </span>
                    <button 
                      onClick={(e) => handleConfirmar(e, alerta.id_alerta)}
                      style={{ fontSize: "12px", color: "#3182ce", background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}