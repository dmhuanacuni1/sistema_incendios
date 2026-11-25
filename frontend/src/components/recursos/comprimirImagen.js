export const TIPOS_ACEPTADOS_IMAGEN = /^image\/(png|jpeg|webp)$/i;
export const LADO_MAXIMO_IMAGEN = 1200;
export const CALIDAD_WEBP = 0.82;
export const MAX_ARCHIVO_IMAGEN = 10_000_000;

/** Reduce la foto en el navegador para no guardar base64 innecesariamente grande. */
export function comprimirImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error("No se pudo leer la imagen."));
    lector.onload = () => {
      const imagen = new Image();
      imagen.onerror = () => rechazar(new Error("No se pudo abrir la imagen."));
      imagen.onload = () => {
        const escala = Math.min(
          1,
          LADO_MAXIMO_IMAGEN / Math.max(imagen.width, imagen.height)
        );
        const lienzo = document.createElement("canvas");
        lienzo.width = Math.round(imagen.width * escala);
        lienzo.height = Math.round(imagen.height * escala);
        lienzo.getContext("2d").drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
        resolver(lienzo.toDataURL("image/webp", CALIDAD_WEBP));
      };
      imagen.src = String(lector.result);
    };
    lector.readAsDataURL(archivo);
  });
}
