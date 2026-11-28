import { useEffect, useMemo, useRef, useState } from "react";

const TIPOS_BASE = [
  "Bosque seco",
  "Bosque húmedo / amazónico",
  "Bosque montano / de niebla",
  "Plantación forestal",
  "Pajonal",
  "Sabana / Pastizal",
  "Matorral / Arbustal",
  "Zona agrícola / Barbecho",
  "Humedal / Bofedal",
];

/**
 * Campo desplegable para elegir un tipo de vegetación de la lista o escribir otro
 * manualmente dentro del mismo control.
 */
export default function SelectorVegetacion({ value = "", onChange, opcionesExistentes = [] }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);

  useEffect(() => {
    function fuera(evento) {
      if (contenedor.current && !contenedor.current.contains(evento.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const opciones = useMemo(() => {
    const mapa = new Map();
    [...TIPOS_BASE, ...opcionesExistentes].forEach((t) => {
      const limpio = String(t || "").trim();
      if (!limpio || limpio.toLowerCase() === "sin especificar") return;
      const clave = limpio.toLowerCase();
      if (!mapa.has(clave)) mapa.set(clave, limpio);
    });
    return [...mapa.values()];
  }, [opcionesExistentes]);

  const filtro = value.trim().toLowerCase();
  const visibles = filtro && abierto
    ? opciones.filter((o) => o.toLowerCase().includes(filtro))
    : opciones;
  const lista = visibles.length ? visibles : opciones;

  return (
    <div className="zr-combo" ref={contenedor}>
      <input
        type="text"
        value={value}
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setAbierto(true);
        }}
        placeholder="Selecciona o escribe un tipo"
        aria-label="Tipo de vegetación"
      />
      <button
        type="button"
        className="zr-combo-btn"
        aria-label="Desplegar tipos de vegetación"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        ▾
      </button>
      {abierto && (
        <div className="zr-combo-lista" role="listbox">
          {lista.map((opcion) => (
            <button
              type="button"
              key={opcion}
              className={`zr-buscador-item${value.trim().toLowerCase() === opcion.toLowerCase() ? " activo" : ""}`}
              onClick={() => {
                onChange(opcion);
                setAbierto(false);
              }}
            >
              {opcion}
            </button>
          ))}
          {value.trim() && !opciones.some((o) => o.toLowerCase() === filtro) && (
            <button
              type="button"
              className="zr-buscador-item zr-combo-nuevo"
              onClick={() => setAbierto(false)}
            >
              Usar manualmente: «{value.trim()}»
            </button>
          )}
        </div>
      )}
    </div>
  );
}
