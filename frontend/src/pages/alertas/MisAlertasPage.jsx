import { useState, useEffect } from "react";
import AppLayout from "../../components/layout/AppLayout";
import Icono from "../../components/layout/IconosVigia";
import { obtenerMisAlertas } from "../../services/alertasService";

export default function MisAlertasPage() {
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        // Nota: Este endpoint devuelve TODAS las alertas del usuario, confirmadas o no
        const data = await obtenerMisAlertas();
        setAlertas(data);
      } catch (error) {
        console.error("Error cargando mis alertas", error);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  return (
    <AppLayout ancha>
      <div className="inc-shell">
        <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <Icono nombre="campana" tamano={24} />
          <h2>Historial de mis Reportes y Notificaciones</h2>
        </div>

        {cargando ? (
          <p>Cargando...</p>
        ) : (
          <div className="tabla-contenedor" style={{ background: "white", borderRadius: "8px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead style={{ backgroundColor: "#f7fafc", borderBottom: "1px solid #e2e8f0" }}>
                <tr>
                  <th style={{ padding: "12px 16px", fontSize: "12px", color: "#718096" }}>ID Alerta</th>
                  <th style={{ padding: "12px 16px", fontSize: "12px", color: "#718096" }}>Incidente</th>
                  <th style={{ padding: "12px 16px", fontSize: "12px", color: "#718096" }}>Tipo Alerta</th>
                  <th style={{ padding: "12px 16px", fontSize: "12px", color: "#718096" }}>Mensaje</th>
                  <th style={{ padding: "12px 16px", fontSize: "12px", color: "#718096" }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {alertas.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: "20px", textAlign: "center", color: "#a0aec0" }}>
                      Aún no tienes notificaciones sobre tus reportes.
                    </td>
                  </tr>
                ) : (
                  alertas.map((item) => (
                    <tr key={item.id_alerta} style={{ borderBottom: "1px solid #edf2f7" }}>
                      <td style={{ padding: "12px 16px" }}>#{item.id_alerta}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {item.id_incidente ? `#${item.id_incidente}` : "N/A (Aviso)"}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: "bold", fontSize: "13px", color: item.tipo.includes("ROJA") ? "#c53030" : item.tipo.includes("AMARILLA") ? "#b7791f" : "#2f855a" }}>
                        {item.tipo}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "14px" }}>{item.mensaje}</td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#718096" }}>
                        {new Date(item.fecha).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}