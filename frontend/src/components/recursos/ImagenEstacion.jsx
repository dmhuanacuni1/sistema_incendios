import { useEffect, useState } from "react";
import * as estacionesService from "../../services/estacionesService";
import { FOTO_ESTACION_PREDETERMINADA } from "./fotoEstacion";

// Las fotos se descargan una sola vez por estación y se comparten entre tarjetas y modal.
const urlsEnCache = new Map();
const EVENTO_FOTO_CAMBIADA = "estacion:foto-cambiada";

/** Libera la URL anterior y fuerza una nueva descarga tras editar/quitar la foto. */
export function invalidarFotoEstacion(idEstacion) {
  const pendiente = urlsEnCache.get(idEstacion);
  if (pendiente && typeof pendiente.then === "function") {
    pendiente
      .then((url) => {
        if (url) URL.revokeObjectURL(url);
      })
      .catch(() => undefined);
  }
  urlsEnCache.delete(idEstacion);
  window.dispatchEvent(
    new CustomEvent(EVENTO_FOTO_CAMBIADA, { detail: Number(idEstacion) })
  );
}

function urlDe(idEstacion) {
  if (!urlsEnCache.has(idEstacion)) {
    const descarga = estacionesService
      .foto(idEstacion)
      .then((blob) => URL.createObjectURL(blob))
      .catch(() => null);
    urlsEnCache.set(idEstacion, descarga);
  }
  return urlsEnCache.get(idEstacion);
}

export function useImagenEstacion(estacion) {
  const id = estacion?.id_estacion;
  const tieneFoto = Boolean(estacion?.tiene_foto ?? estacion?.foto_url);
  const [url, setUrl] = useState(FOTO_ESTACION_PREDETERMINADA);

  useEffect(() => {
    if (!id || !tieneFoto) {
      setUrl(FOTO_ESTACION_PREDETERMINADA);
      return undefined;
    }

    let activo = true;
    function cargar() {
      urlDe(id).then((resultado) => {
        if (activo) setUrl(resultado || FOTO_ESTACION_PREDETERMINADA);
      });
    }

    function alCambiar(evento) {
      if (Number(evento.detail) !== Number(id)) return;
      setUrl(FOTO_ESTACION_PREDETERMINADA);
      cargar();
    }

    cargar();
    window.addEventListener(EVENTO_FOTO_CAMBIADA, alCambiar);
    return () => {
      activo = false;
      window.removeEventListener(EVENTO_FOTO_CAMBIADA, alCambiar);
    };
  }, [id, tieneFoto]);

  return url;
}

export default function ImagenEstacion({ estacion, ...props }) {
  const url = useImagenEstacion(estacion);
  return <img src={url} alt={`Foto de ${estacion?.nombre || "la estación"}`} {...props} />;
}
