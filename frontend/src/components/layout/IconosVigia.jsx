/**
 * Iconos SVG inline con estética Lucide (trazo 1.8, puntas redondas).
 * Los trazos viven aquí para no agregar dependencias de iconos externas.
 */
const TRAZOS = {
  llama: (
    <>
      <path d="M12 22c4 0 7-2.8 7-6.5 0-2.4-1.3-4.3-2.9-5.9-.2 1.8-1 3-2.2 3.7.2-3-1-5.6-3.4-8.3.2 3.1-1 5.1-2.6 6.7C6.3 13 5.5 14.4 5 15.8 5 19.3 8 22 12 22Z" />
      <path d="M12 22c1.7 0 3-1.2 3-2.8 0-1.3-.8-2.1-1.6-2.9-.1 1-.7 1.7-1.5 2 0-1.4-.6-2.5-1.6-3.4-.2 1.3-.8 2.2-1.6 3-.4.4-.7 1-.7 1.6 0 1.6 1.4 2.5 3.2 2.5Z" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  cerrar: <path d="M18 6 6 18M6 6l12 12" />,
  flechaIzquierda: <path d="M19 12H5M12 19l-7-7 7-7" />,
  chevronDerecha: <path d="m9 18 6-6-6-6" />,
  ubicacion: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  alerta: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  check: <path d="m5 12 5 5L20 7" />,
  escudo: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  salir: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
  usuario: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  panelLateral: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </>
  ),
  capas: (
    <>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
    </>
  ),
  estacion: (
    <>
      <path d="M3 21V8l9-5 9 5v13" />
      <path d="M3 21h18M9 21v-7h6v7" />
      <path d="M7 10h.01M17 10h.01" />
    </>
  ),
  incidente: (
    <>
      <path d="M7 4 5 2M17 4l2-2M12 2v3M4 14a8 8 0 1 1 16 0v5H4v-5Z" />
      <path d="M4 19h16M9 22h6M12 9v4" />
    </>
  ),
  automovil: (
    <>
      <path d="M5 17H4a2 2 0 0 1-2-2v-3l2-5a2 2 0 0 1 2-1h12a2 2 0 0 1 2 1l2 5v3a2 2 0 0 1-2 2h-1" />
      <path d="M5 17h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" />
      <path d="M7 11h2M15 11h2M5 17v2h14v-2" />
      <circle cx="7.5" cy="14" r="1" />
      <circle cx="16.5" cy="14" r="1" />
    </>
  ),
  mantenimiento: (
    <>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-3 3-3-3 3-3Z" />
    </>
  ),
  radio: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
    </>
  ),
  agua: (
    <>
      <path d="M12 2.7S5 10.3 5 15a7 7 0 0 0 14 0c0-4.7-7-12.3-7-12.3Z" />
      <path d="M9 15a3 3 0 0 0 3 3" />
    </>
  ),
    // Agrega esto dentro de TRAZOS:
  campana: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  historial: (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5M12 7v5l4 2" />
    </>
  ),
};

export default function Icono({ nombre, tamano = 20, className = "" }) {
  const trazo = TRAZOS[nombre] || TRAZOS.capas;
  return (
    <svg
      className={className}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {trazo}
    </svg>
  );
}
