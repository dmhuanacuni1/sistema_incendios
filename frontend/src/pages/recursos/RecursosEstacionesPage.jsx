import { useMemo } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import Icono from "../../components/layout/IconosVigia";
import { estadoRecurso, estadoUnidad, iconoRecurso } from "../../components/recursos/estadosRecursos";
import ImagenEstacion from "../../components/recursos/ImagenEstacion";
import { useVigia } from "../../context/VigiaContext";
import { useAuth } from "../../hooks/useAuth";

function idDe(registro) {
  return registro.id_unidad ?? registro.id_recurso ?? registro.id;
}

function UnidadFila({ unidad }) {
  const estado = estadoUnidad(unidad.estado);
  return (
    <li className="re-unidad">
      <span className="re-unidad-icono"><Icono nombre="automovil" tamano={22} /></span>
      <span className="re-unidad-datos">
        <strong>Unidad Móvil {unidad.codigo || "—"}</strong>
        <small>
          {unidad.tipo || "Vehículo"} · Placa/código {unidad.codigo || "—"}
          {unidad.capacidad ? ` · Cap. ${unidad.capacidad}` : ""}
        </small>
      </span>
      <span className={`re-estado ${estado.clase}`}>
        <i className="vg-punto" /> {estado.etiqueta}
      </span>
    </li>
  );
}

function TarjetaEstacion({ estacion, onAbrir, esAdmin }) {
  function abrirConTeclado(evento) {
    if (evento.key !== "Enter" && evento.key !== " ") return;
    evento.preventDefault();
    onAbrir(estacion.id_estacion);
  }

  return (
    <article
      className="re-card"
      role="button"
      tabIndex={0}
      onClick={() => onAbrir(estacion.id_estacion)}
      onKeyDown={abrirConTeclado}
      aria-label={`Gestionar ${estacion.nombre}`}
    >
      <div className="re-card-foto">
        <ImagenEstacion estacion={estacion} loading="lazy" />
        <span className="re-card-foto-etiqueta">
          <Icono nombre="estacion" tamano={14} /> Estación
        </span>
      </div>

      <div className="re-card-cuerpo">
        <div className="re-card-cabecera">
          <div className="re-card-identidad">
            <span className="re-card-icono"><Icono nombre="estacion" tamano={24} /></span>
            <div>
              <h2>{estacion.nombre}</h2>
              <p>
                <Icono nombre="ubicacion" tamano={14} /> {estacion.direccion || "Ubicación sin registrar"}
                {estacion.telefono ? ` · ${estacion.telefono}` : ""}
              </p>
            </div>
          </div>
          <div className="re-card-lado">
            <span
              className={`re-badge-disponible${
                estacion.estado === "DE_BAJA" ? " re-badge-baja" : ""
              }`}
            >
              <i className="vg-punto" /> {estacion.estado === "DE_BAJA" ? "De baja" : "Disponible"}
            </span>
            <button
              type="button"
              className="re-boton-gestionar"
              onClick={(evento) => {
                evento.stopPropagation();
                onAbrir(estacion.id_estacion);
              }}
            >
              Gestionar <Icono nombre="chevronDerecha" tamano={16} />
            </button>
            {esAdmin && (
              <Link
                to={`/recursos/unidades/nueva?estacion=${estacion.id_estacion}`}
                className="re-boton-agregar"
                onClick={(evento) => evento.stopPropagation()}
              >
                <Icono nombre="mas" tamano={15} /> Unidad/Recurso
              </Link>
            )}
          </div>
        </div>

        <div className="re-card-secciones">
          <section className="re-seccion">
            <h3><Icono nombre="automovil" tamano={17} /> Unidades asignadas ({estacion.unidades.length})</h3>
            {estacion.unidades.length > 0 ? (
              <ul className="re-unidades">
                {estacion.unidades.map((unidad) => (
                  <UnidadFila key={idDe(unidad)} unidad={unidad} />
                ))}
              </ul>
            ) : (
              <p className="re-vacio-seccion">Sin unidades registradas en esta estación.</p>
            )}
          </section>

          <section className="re-seccion">
            <h3><Icono nombre="capas" tamano={17} /> Recursos disponibles ({estacion.recursos.length})</h3>
            {estacion.recursos.length > 0 ? (
              <div className="re-chips">
                {estacion.recursos.map((recurso) => {
                  const estado = estadoRecurso(recurso.estado);
                  return (
                    <span className={`re-chip ${estado.clase}`} key={idDe(recurso)}>
                      <Icono nombre={iconoRecurso(recurso.tipo_recurso)} tamano={15} />
                      {recurso.nombre}: <strong>{recurso.cantidad}</strong>
                      {recurso.tipo_recurso ? <small>{recurso.tipo_recurso}</small> : null}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="re-vacio-seccion">Sin recursos registrados en esta estación.</p>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}

export default function RecursosEstacionesPage() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "ADMINISTRADOR";
  const {
    estaciones,
    cargandoEstaciones,
    errorEstaciones,
    abrirEstacion,
    busqueda,
    setBusqueda,
    cargarEstaciones,
  } = useVigia();

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return estaciones;
    return estaciones.filter((estacion) =>
      [
        estacion.nombre,
        estacion.direccion,
        estacion.telefono,
        ...estacion.unidades.flatMap((u) => [u.codigo, u.tipo]),
        ...estacion.recursos.flatMap((r) => [r.nombre, r.tipo_recurso]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [estaciones, busqueda]);

  const kpis = useMemo(
    () => ({
      estaciones: estaciones.filter((e) => (e.estado || "ACTIVA") === "ACTIVA").length,
      unidades: estaciones.reduce((total, e) => total + e.unidades.length, 0),
      enBase: estaciones.reduce(
        (total, e) => total + e.unidades.filter((u) => u.estado === "DISPONIBLE").length,
        0
      ),
      recursos: estaciones.reduce(
        (total, e) => total + e.recursos.reduce((suma, r) => suma + Number(r.cantidad || 0), 0),
        0
      ),
    }),
    [estaciones]
  );

  return (
    <AppLayout ancha suelta>
      <div className="re-pagina">
        <div className="re-titulo">
          <div>
            <span className="re-etiqueta">Sprint 1 · Infraestructura</span>
            <h1>Recursos y Estaciones</h1>
            <p>Bases operativas, unidades móviles e inventario disponible en tiempo real.</p>
          </div>
          <Link to="/recursos/consultar" className="re-enlace-consulta">
            Consulta detallada <Icono nombre="chevronDerecha" tamano={15} />
          </Link>
        </div>

        <div className="re-kpis">
          <div className="re-kpi re-kpi-oscuro">
            <span className="re-kpi-icono"><Icono nombre="estacion" tamano={20} /></span>
            <span><strong>{kpis.estaciones}</strong><small>Estaciones activas</small></span>
          </div>
          <div className="re-kpi">
            <span className="re-kpi-icono"><Icono nombre="automovil" tamano={20} /></span>
            <span><strong>{kpis.unidades}</strong><small>Unidades móviles</small></span>
          </div>
          <div className="re-kpi re-kpi-dorado">
            <span className="re-kpi-icono"><Icono nombre="check" tamano={20} /></span>
            <span><strong>{kpis.enBase}</strong><small>Unidades en base</small></span>
          </div>
          <div className="re-kpi">
            <span className="re-kpi-icono"><Icono nombre="capas" tamano={20} /></span>
            <span><strong>{kpis.recursos}</strong><small>Recursos disponibles</small></span>
          </div>
        </div>

        <div className="re-listado-cabecera">
          <div>
            <h2>Estaciones registradas</h2>
            <p>
              {busqueda
                ? `${filtradas.length} de ${estaciones.length} estaciones coinciden con “${busqueda}”`
                : `${estaciones.length} bases operativas en el sistema`}
            </p>
          </div>
          <div className="re-listado-acciones">
            {busqueda && (
              <button type="button" className="vg-boton-secundario" onClick={() => setBusqueda("")}>
                Limpiar filtro
              </button>
            )}
            <button
              type="button"
              className="vg-boton-secundario"
              onClick={cargarEstaciones}
              disabled={cargandoEstaciones}
              title="Volver a consultar la base de datos"
            >
              Actualizar lista
            </button>
          </div>
        </div>

        {cargandoEstaciones ? (
          <div className="re-estado-carga">Cargando estaciones desde la base de datos…</div>
        ) : errorEstaciones ? (
          <div className="re-estado-carga re-estado-error">
            <p>{errorEstaciones}</p>
            <button type="button" className="vg-boton-secundario" onClick={cargarEstaciones}>
              Reintentar
            </button>
          </div>
        ) : filtradas.length > 0 ? (
          <div className="re-listado">
            {filtradas.map((estacion) => (
              <TarjetaEstacion
                key={estacion.id_estacion}
                estacion={estacion}
                onAbrir={abrirEstacion}
                esAdmin={esAdmin}
              />
            ))}
          </div>
        ) : (
          <div className="re-estado-carga">
            <Icono nombre="buscar" tamano={30} />
            <h3>Sin estaciones que coincidan</h3>
            <p>Ajusta el buscador de la cabecera para ver otras bases operativas.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
