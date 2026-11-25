import { api, apiBlob } from "../api/client";


// Generar un nuevo informe
export async function generarInforme(datos = {}) {
    const respuesta = await api("/informes", {
        method: "POST",
        body: datos,
    });

    return respuesta.data;
}


// Consultar el historial de informes
export async function listarInformes() {
    const respuesta = await api("/informes");

    return respuesta.data;
}


// Consultar el detalle de un informe
export async function obtenerDetalleInforme(idReporte) {
    const respuesta = await api(
        `/informes/${idReporte}`
    );

    return respuesta.data;
}


// Descargar el documento original
export async function descargarInforme(idReporte) {
    const detalle = await obtenerDetalleInforme(idReporte);

    if (!detalle.archivo_disponible || !detalle.archivo) {
        throw new Error(
            "El archivo del informe no esta disponible"
        );
    }

    const archivo = await apiBlob(
        `/informes/${idReporte}/descargar`
    );

    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = detalle.archivo.nombre_archivo;

    try {
        document.body.appendChild(enlace);
        enlace.click();
    } finally {
        enlace.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    return {
        nombre_archivo: detalle.archivo.nombre_archivo,
        tamano_bytes: archivo.size,
        tipo_mime: archivo.type,
    };
}

// Recuperar el archivo original para su visualizacion
export async function obtenerArchivoInforme(idReporte) {
    const archivo = await apiBlob(
        `/informes/${idReporte}/descargar`
    );

    return archivo;
}

export async function obtenerContenidoExcel(idReporte) {
    const respuesta = await api(
        `/informes/${idReporte}/contenido`
    );

    return respuesta.data;
}

// Crear un identificador unico para cada solicitud
export function crearIdSolicitud() {
    return globalThis.crypto.randomUUID();
}

export async function generarInformeEstructurado(
    datos = {},
    idSolicitud
) {
    if (
        typeof idSolicitud !== "string" ||
        !idSolicitud.trim()
    ) {
        throw new Error(
            "Debe proporcionar un identificador de solicitud"
        );
    }

    const respuesta = await api("/informes/generar", {
        method: "POST",
        body: {
            ...datos,
            id_solicitud: idSolicitud,
        },
    });

    return respuesta.data;
}


export async function exportarInforme(idReporte, formato) {
    const formatoNormalizado = String(formato).toUpperCase();

    if (!["PDF", "EXCEL"].includes(formatoNormalizado)) {
        throw new Error("Formato de exportación no válido");
    }

    const detalle = await obtenerDetalleInforme(idReporte);

    if (!detalle.formatos_exportacion?.includes(formatoNormalizado)) {
        throw new Error("El formato solicitado no está disponible");
    }

    const archivo = await apiBlob(
        `/informes/${idReporte}/exportar?formato=${formatoNormalizado}`
    );

    const extension = formatoNormalizado === "PDF"
        ? "pdf"
        : "xlsx";

    const nombreArchivo = detalle.contenido_disponible
        ? `informe_${detalle.tipo_reporte.toLowerCase()}_${idReporte}.${extension}`
        : detalle.archivo?.nombre_archivo
            || `informe_${idReporte}.${extension}`;

    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = nombreArchivo;

    try {
        document.body.appendChild(enlace);
        enlace.click();
    } finally {
        enlace.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    return {
        nombre_archivo: nombreArchivo,
        tamano_bytes: archivo.size,
        tipo_mime: archivo.type,
    };
}