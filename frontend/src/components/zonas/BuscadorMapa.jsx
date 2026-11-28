import { useEffect, useRef, useState } from "react";
import { DEPARTAMENTOS, centroide, normalizar } from "../../utils/geoBolivia";
import { buscarLugares } from "../../services/climaService";


export default function BuscadorMapa({
  valor,
  onValorChange,
  onSeleccionar,
  zonas = [],
  placeholder = "Buscar departamento, zona, calle o barrio…",
  incluirDepartamentos = true,
  incluirZonas = true,
}) {
  const [abierto, setAbierto] = useState(false);
  const [lugares, setLugares] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [errorLugares, setErrorLugares] = useState("");
  const contenedor = useRef(null);
  const consulta = useRef(0);

  const texto = normalizar(valor);

  useEffect(() => {
    function fuera(evento) {
      if (contenedor.current && !contenedor.current.contains(evento.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  async function consultarLugares(consultaTexto) {
    const actual = ++consulta.current;
    setBuscando(true);
    setErrorLugares("");
    try {
      const resultado = await buscarLugares(consultaTexto);
      if (actual === consulta.current) setLugares(resultado);
    } catch (err) {
      if (actual === consulta.current) {
        setLugares([]);
        setErrorLugares(err.message);
      }
    } finally {
      if (actual === consulta.current) setBuscando(false);
    }
  }

  useEffect(() => {
    if (texto.length < 3) {
      consulta.current += 1;
      setLugares([]);
      setBuscando(false);
      return undefined;
    }
    const espera = setTimeout(() => consultarLugares(valor.trim()), 650);
    return () => clearTimeout(espera);
  }, [valor]); // eslint-disable-line react-hooks/exhaustive-deps

  const departamentos = incluirDepartamentos
    ? DEPARTAMENTOS.filter((d) => !texto || normalizar(d.nombre).includes(texto))
    : [];
  const zonasCoinciden = incluirZonas && texto
    ? zonas
      .filter((z) => normalizar(`${z.nombre} ${z.ubicacion}`).includes(texto) && centroide(z.coordenadas))
      .slice(0, 6)
    : [];

  function elegir(seleccion) {
    setAbierto(false);
    onSeleccionar?.(seleccion);
  }

  const hayAlgo = departamentos.length || zonasCoinciden.length || lugares.length || buscando || errorLugares;

  return (
    <div className="zr-buscador" ref={contenedor}>
      <input
        type="search"
        className="zr-buscador-input"
        value={valor}
        placeholder={placeholder}
        aria-label="Buscar en el mapa"
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          onValorChange(e.target.value);
          setAbierto(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (texto.length >= 2) consultarLugares(valor.trim());
            setAbierto(true);
          }
          if (e.key === "Escape") setAbierto(false);
        }}
      />
      {abierto && hayAlgo ? (
        <div className="zr-buscador-lista" role="listbox">
          {departamentos.length > 0 && <p className="zr-buscador-grupo">Departamentos</p>}
          {departamentos.map((d) => (
            <button type="button" key={d.nombre} className="zr-buscador-item" onClick={() => elegir({ tipo: "departamento", departamento: d.nombre })}>
              🗺️ {d.nombre}
            </button>
          ))}
          {zonasCoinciden.length > 0 && <p className="zr-buscador-grupo">Zonas de riesgo</p>}
          {zonasCoinciden.map((z) => {
            const c = centroide(z.coordenadas);
            return (
              <button type="button" key={z.id_zona} className="zr-buscador-item" onClick={() => elegir({ tipo: "zona", zona: z, lat: c.lat, lng: c.lng })}>
                🔥 {z.nombre} <small>· {z.nivel_riesgo}</small>
              </button>
            );
          })}
          {(lugares.length > 0 || buscando || errorLugares) && <p className="zr-buscador-grupo">Calles, barrios y lugares</p>}
          {buscando && <p className="zr-buscador-estado">Buscando lugares…</p>}
          {errorLugares && <p className="zr-buscador-estado">{errorLugares}</p>}
          {!buscando && !errorLugares && texto.length >= 3 && lugares.length === 0 && (
            <p className="zr-buscador-estado">Sin lugares para «{valor.trim()}».</p>
          )}
          {lugares.map((l) => (
            <button type="button" key={l.id} className="zr-buscador-item" onClick={() => elegir({ tipo: "lugar", nombre: l.nombre, lat: l.lat, lng: l.lng, bbox: l.bbox, address: l.address })}>
              📍 {l.nombre}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
