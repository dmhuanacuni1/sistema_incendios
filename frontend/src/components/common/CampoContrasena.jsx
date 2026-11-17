import { useState } from "react";

function Ojo({ tachado }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M2.6 12S6.2 6.6 12 6.6 21.4 12 21.4 12 17.8 17.4 12 17.4 2.6 12 2.6 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      {tachado && (
        <path d="M5 19 19 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

export default function CampoContrasena({ id, etiqueta, etiquetaOculta = false, ...props }) {
  const [visible, setVisible] = useState(false);
  const control = (
    <span className="clave">
      <input id={id} {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="clave-ojo"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        onClick={() => setVisible((actual) => !actual)}
      >
        <Ojo tachado={visible} />
      </button>
    </span>
  );

  if (!etiqueta) return control;

  return (
    <label className={etiquetaOculta ? "campo-linea" : "campo"} htmlFor={id}>
      <span className={etiquetaOculta ? "sr-only" : undefined}>{etiqueta}</span>
      {control}
    </label>
  );
}
