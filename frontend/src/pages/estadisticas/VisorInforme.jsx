import { useEffect, useState } from "react";

import {
    obtenerArchivoInforme,
    obtenerContenidoExcel,
} from "../../services/informesService";

function formatearCelda(valor, formato = "General") {
    if (valor === null || valor === undefined) {
        return "";
    }

    if (typeof valor !== "number") {
        return String(valor);
    }

    // Formato de porcentaje
    if (formato.includes("%")) {
        return new Intl.NumberFormat("es-BO", {
            style: "percent",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(valor);
    }

    // Formato monetario en bolivianos
    if (formato.includes("Bs")) {
        return "Bs " + new Intl.NumberFormat("es-BO", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true,
        }).format(valor);
    }

    // Formato numerico con dos decimales
    if (formato.includes("0.00")) {
        return new Intl.NumberFormat("es-BO", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(valor);
    }

    // Formato general
    return String(valor);
}

export default function VisorInforme({
    idReporte,
    formato,
}) {
    const [url, setUrl] = useState(null);
    const [excel, setExcel] = useState(null);
    const [hojaActiva, setHojaActiva] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [intento, setIntento] = useState(0);

    useEffect(() => {
        let activo = true;
        let urlTemporal = null;

        setUrl(null);
        setExcel(null);
        setHojaActiva(0);
        setError("");
        setCargando(true);

        async function cargarArchivo() {
            try {
                if (formato === "PDF") {
                    const archivo =
                        await obtenerArchivoInforme(idReporte);

                    if (!activo) return;

                    const pdf = new Blob(
                        [archivo],
                        { type: "application/pdf" }
                    );

                    urlTemporal = URL.createObjectURL(pdf);

                    setUrl(urlTemporal);

                } else if (formato === "EXCEL") {
                    const contenido =
                        await obtenerContenidoExcel(idReporte);

                    if (!activo) return;

                    setExcel(contenido);
                }

            } catch (err) {
                if (activo) {
                    setError(
                        "No se pudo visualizar el documento original."
                    );
                }

            } finally {
                if (activo) {
                    setCargando(false);
                }
            }
        }

        cargarArchivo();

        return () => {
            activo = false;

            if (urlTemporal) {
                URL.revokeObjectURL(urlTemporal);
            }
        };

    }, [idReporte, formato, intento]);

    const hoja = excel?.hojas?.[hojaActiva];

    return (
        <div className="est-detalle-bloque">

            <h3>Contenido del informe</h3>

            {cargando && (
                <div className="est-cargando" role="status">
                    <span className="est-spinner" />
                    <p>Cargando documento original...</p>
                </div>
            )}

            {error && (
                <div className="est-error" role="alert">
                    <p>{error}</p>

                    <button
                        type="button"
                        className="est-boton-primario"
                        onClick={() =>
                            setIntento(anterior => anterior + 1)
                        }
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {!cargando && !error &&
                formato !== "PDF" &&
                formato !== "EXCEL" && (
                    <p className="est-aviso">
                        La visualización de este formato
                        no está disponible.
                    </p>
                )
            }

            {/* Visualizador PDF */}

            {!cargando && !error &&
                formato === "PDF" && url && (
                    <iframe
                        src={url}
                        title={`Informe PDF ${idReporte}`}
                        style={{
                            width: "100%",
                            height: "700px",
                            border: "1px solid var(--vg-borde, #ddd)",
                            borderRadius: "12px",
                        }}
                    />
                )
            }

            {/* Visualizador Excel */}

            {!cargando && !error &&
                formato === "EXCEL" && excel && (

                    <div className="est-excel-visor">

                        <div className="est-excel-cabecera">
                            <strong>
                                {excel.nombre_archivo}
                            </strong>

                            <span>
                                {excel.total_hojas} hojas
                            </span>
                        </div>

                        <div
                            className="est-excel-pestanas"
                            role="group"
                            aria-label="Hojas del informe"
                        >
                            {excel.hojas.map((item, indice) => (
                                <button
                                    key={item.nombre}
                                    type="button"
                                    aria-pressed={hojaActiva === indice}
                                    className={
                                        hojaActiva === indice
                                            ? "est-excel-pestana activa"
                                            : "est-excel-pestana"
                                    }
                                    onClick={() =>
                                        setHojaActiva(indice)
                                    }
                                >
                                    {item.nombre}
                                </button>
                            ))}
                        </div>

                        {hoja && (
                            <>
                                <div className="est-excel-info">
                                    <strong>{hoja.nombre}</strong>

                                    <span>
                                        {hoja.total_filas} filas ·{" "}
                                        {hoja.total_columnas} columnas
                                    </span>
                                </div>

                                <div className="est-excel-contenedor">

                                    <table className="est-excel-tabla">

                                        <tbody>
                                            {hoja.filas.map(
                                                (fila, indiceFila) => (
                                                    <tr key={indiceFila}>

                                                        <th scope="row">
                                                            {indiceFila + 1}
                                                        </th>

                                                        {Array.from(
                                                            {
                                                                length:
                                                                    hoja.total_columnas,
                                                            },
                                                            (_, columna) => {
                                                                const valor =
    fila[columna] ?? "";

const formatoCelda =
    hoja.formatos?.[indiceFila]?.[columna]
    ?? "General";

const valorFormateado =
    formatearCelda(valor, formatoCelda);

                                                                return indiceFila === 0 ? (
                                                                    <th
                                                                        key={columna}
                                                                        scope="col"
                                                                    >
                                                                        {valorFormateado}
                                                                    </th>
                                                                ) : (
                                                                    <td key={columna}>
                                                                        {valorFormateado}
                                                                    </td>
                                                                );
                                                            }
                                                        )}

                                                    </tr>
                                                )
                                            )}
                                        </tbody>

                                    </table>

                                </div>
                            </>
                        )}

                        {!hoja && (
                            <p className="est-aviso">
                                El documento no contiene hojas disponibles.
                            </p>
                        )}

                        <p className="est-excel-nota">
                            Vista previa de solo lectura.
                            Descarga el archivo original para consultar
                            sus gráficos y formatos completos.
                        </p>

                    </div>
                )
            }

        </div>
    );
}