import { useEffect, useMemo, useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import Campo from "../../components/common/Campo";
import CampoContrasena from "../../components/common/CampoContrasena";
import { guardarSesion } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import * as usuariosService from "../../services/usuariosService";
import { REGLA_CONTRASENA, contrasenaValida } from "../../utils/contrasena";

const ROLES = ["ADMINISTRADOR", "OPERADOR", "BOMBERO", "CIUDADANO"];
const ESTADOS = ["ACTIVO", "INACTIVO", "BLOQUEADO"];
const ETIQUETAS = {
  ADMINISTRADOR: "Administrador",
  OPERADOR: "Operador",
  BOMBERO: "Bombero",
  CIUDADANO: "Ciudadano",
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
  BLOQUEADO: "Bloqueado",
};

function etiqueta(valor) {
  return ETIQUETAS[valor] || valor;
}

function aBorrador(item) {
  return {
    nombre_usuario: item.nombre_usuario,
    nombres: item.persona.nombres,
    apellidos: item.persona.apellidos,
    correo: item.persona.correo || "",
    rol: item.rol,
    estado: item.estado,
    contrasena: "",
  };
}

function sinTokens(data) {
  const usuario = { ...data };
  delete usuario.access_token;
  delete usuario.refresh_token;
  return usuario;
}
const VACIO = {
  nombres: "",
  apellidos: "",
  telefono: "",
  correo: "",
  direccion: "",
  nombre_usuario: "",
  contrasena: "",
  rol: "OPERADOR",
};

export default function UsuariosPage() {
  const { usuario: sesion, setUsuario } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [borradores, setBorradores] = useState({});
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [zona, setZona] = useState("lista");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null);
  const [creando, setCreando] = useState(false);
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const visibles = useMemo(
    () =>
      usuarios.filter((item) => {
        if (filtroRol && item.rol !== filtroRol) return false;
        if (filtroEstado && item.estado !== filtroEstado) return false;
        return true;
      }),
    [usuarios, filtroRol, filtroEstado]
  );

  useEffect(() => {
    let activo = true;
    usuariosService
      .listar()
      .then((lista) => {
        if (!activo) return;
        setUsuarios(lista);
        setBorradores(Object.fromEntries(lista.map((item) => [item.id_usuario, aBorrador(item)])));
      })
      .catch((err) => {
        if (!activo) return;
        setZona("lista");
        setError(err.message);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  function cambiar(event) {
    setForm((actual) => ({ ...actual, [event.target.name]: event.target.value }));
  }

  async function crear(event) {
    event.preventDefault();
    if (!contrasenaValida(form.contrasena)) {
      setZona("alta");
      setMensaje("");
      setError(REGLA_CONTRASENA);
      return;
    }
    setZona("alta");
    setError("");
    setMensaje("");
    setCreando(true);
    try {
      const creado = await usuariosService.crear(form);
      setUsuarios((lista) => [...lista, creado]);
      setBorradores((actual) => ({ ...actual, [creado.id_usuario]: aBorrador(creado) }));
      setForm(VACIO);
      setMensaje(`Cuenta ${creado.nombre_usuario} creada`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  function cambiarBorrador(idUsuario, campo, valor) {
    setBorradores((actual) => ({
      ...actual,
      [idUsuario]: { ...actual[idUsuario], [campo]: valor },
    }));
  }

  async function guardar(idUsuario) {
    const borrador = borradores[idUsuario];
    if (!borrador) return;
    if (borrador.contrasena.trim() && !contrasenaValida(borrador.contrasena)) {
      setZona("lista");
      setMensaje("");
      setError(REGLA_CONTRASENA);
      return;
    }
    setZona("lista");
    setError("");
    setMensaje("");
    setGuardando(idUsuario);
    try {
      const data = await usuariosService.actualizar(idUsuario, {
        ...borrador,
        contrasena: borrador.contrasena.trim(),
      });
      const actualizado = sinTokens(data);
      setUsuarios((lista) => lista.map((item) => (item.id_usuario === idUsuario ? actualizado : item)));
      setBorradores((actual) => ({ ...actual, [idUsuario]: aBorrador(actualizado) }));
      if (data.access_token) {
        guardarSesion(data);
        setUsuario(actualizado);
      } else if (sesion?.id_usuario === idUsuario) {
        setUsuario(actualizado);
      }
      setMensaje(`Cuenta ${actualizado.nombre_usuario} actualizada`);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(null);
    }
  }

  return (
    <AppLayout ancha suelta>
      <section className="cuenta-tarjeta cuenta-tarjeta-ancha">
        <h1>Nueva cuenta</h1>
        <p className="bajada">Registra a una persona y asígnale un rol. {REGLA_CONTRASENA}.</p>
        {zona === "alta" && error && <p className="aviso">{error}</p>}
        {zona === "alta" && mensaje && <p className="ok">{mensaje}</p>}

        <form className="form-acceso" onSubmit={crear}>
          <div className="rejilla">
            <Campo id="alta-nombres" name="nombres" etiqueta="Nombres" value={form.nombres} onChange={cambiar} required />
            <Campo id="alta-apellidos" name="apellidos" etiqueta="Apellidos" value={form.apellidos} onChange={cambiar} required />
          </div>
          <div className="rejilla">
            <Campo id="alta-telefono" name="telefono" etiqueta="Teléfono" value={form.telefono} onChange={cambiar} />
            <Campo id="alta-correo" name="correo" etiqueta="Correo" type="email" value={form.correo} onChange={cambiar} required />
          </div>
          <div className="rejilla">
            <Campo id="alta-direccion" name="direccion" etiqueta="Dirección" value={form.direccion} onChange={cambiar} />
          </div>
          <div className="rejilla">
            <Campo
              id="alta-usuario"
              name="nombre_usuario"
              etiqueta="Usuario"
              value={form.nombre_usuario}
              onChange={cambiar}
              required
            />
            <CampoContrasena
              id="alta-contrasena"
              name="contrasena"
              etiqueta="Contraseña"
              autoComplete="new-password"
              value={form.contrasena}
              onChange={cambiar}
              required
              minLength={8}
            />
          </div>
          <label className="campo" htmlFor="alta-rol">
            <span>Rol</span>
            <select id="alta-rol" name="rol" value={form.rol} onChange={cambiar}>
              {ROLES.map((rol) => (
                <option key={rol} value={rol}>{etiqueta(rol)}</option>
              ))}
            </select>
          </label>
          <button className="boton boton-oscuro" type="submit" disabled={creando}>
            {creando ? "Creando…" : "Crear cuenta"}
          </button>
        </form>
      </section>

      <section className="cuenta-tarjeta cuenta-tarjeta-ancha">
        <h1>Cuentas</h1>
        <p className="bajada">Edita usuario, nombre, rol, estado y contraseña. Deja la contraseña vacía si no quieres cambiarla. Si escribes una, debe cumplir la misma regla que una cuenta nueva.</p>
        <div className="filtros">
          <label htmlFor="filtro-rol">
            <span>Rol</span>
            <select id="filtro-rol" value={filtroRol} onChange={(event) => setFiltroRol(event.target.value)}>
              <option value="">Todos</option>
              {ROLES.map((rol) => (
                <option key={rol} value={rol}>{etiqueta(rol)}</option>
              ))}
            </select>
          </label>
          <label htmlFor="filtro-estado">
            <span>Estado</span>
            <select id="filtro-estado" value={filtroEstado} onChange={(event) => setFiltroEstado(event.target.value)}>
              <option value="">Todos</option>
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>{etiqueta(estado)}</option>
              ))}
            </select>
          </label>
          <p className="filtros-resumen">
            {cargando
              ? "Cargando…"
              : filtroRol || filtroEstado
                ? `${visibles.length} de ${usuarios.length}`
                : usuarios.length === 1
                  ? "1 cuenta"
                  : `${usuarios.length} cuentas`}
          </p>
        </div>
        {zona === "lista" && error && <p className="aviso">{error}</p>}
        {zona === "lista" && mensaje && <p className="ok">{mensaje}</p>}

        {cargando ? (
          <p className="estado">Cargando usuarios…</p>
        ) : (
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Contraseña</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr>
                    <td className="tabla-vacia" colSpan={7}>Ninguna cuenta coincide con esos filtros.</td>
                  </tr>
                )}
                {visibles.map((item) => {
                  const borrador = borradores[item.id_usuario] || aBorrador(item);
                  const propio = sesion?.id_usuario === item.id_usuario;
                  return (
                    <tr key={item.id_usuario}>
                      <td data-etiqueta="Usuario">
                        <input
                          aria-label={`Usuario de ${item.nombre_usuario}`}
                          value={borrador.nombre_usuario}
                          onChange={(event) => cambiarBorrador(item.id_usuario, "nombre_usuario", event.target.value)}
                          required
                        />
                      </td>
                      <td data-etiqueta="Correo">
                        <input
                          aria-label={`Correo de ${item.nombre_usuario}`}
                          type="email"
                          value={borrador.correo}
                          onChange={(event) => cambiarBorrador(item.id_usuario, "correo", event.target.value)}
                          required
                        />
                      </td>
                      <td className="celda-nombre" data-etiqueta="Nombre">
                        <input
                          aria-label={`Nombres de ${item.nombre_usuario}`}
                          placeholder="Nombres"
                          value={borrador.nombres}
                          onChange={(event) => cambiarBorrador(item.id_usuario, "nombres", event.target.value)}
                          required
                        />
                        <input
                          aria-label={`Apellidos de ${item.nombre_usuario}`}
                          placeholder="Apellidos"
                          value={borrador.apellidos}
                          onChange={(event) => cambiarBorrador(item.id_usuario, "apellidos", event.target.value)}
                          required
                        />
                      </td>
                      <td data-etiqueta="Rol">
                        <select
                          aria-label={`Rol de ${item.nombre_usuario}`}
                          value={borrador.rol}
                          disabled={propio}
                          title={propio ? "No puedes cambiar tu propio rol" : undefined}
                          onChange={(event) => cambiarBorrador(item.id_usuario, "rol", event.target.value)}
                        >
                          {ROLES.map((rol) => (
                            <option key={rol} value={rol}>{etiqueta(rol)}</option>
                          ))}
                        </select>
                      </td>
                      <td data-etiqueta="Estado">
                        <select
                          aria-label={`Estado de ${item.nombre_usuario}`}
                          value={borrador.estado}
                          disabled={propio}
                          title={propio ? "No puedes cambiar tu propio estado" : undefined}
                          onChange={(event) => cambiarBorrador(item.id_usuario, "estado", event.target.value)}
                        >
                          {ESTADOS.map((estado) => (
                            <option key={estado} value={estado}>{etiqueta(estado)}</option>
                          ))}
                        </select>
                      </td>
                      <td data-etiqueta="Contraseña">
                        <CampoContrasena
                          id={`clave-${item.id_usuario}`}
                          aria-label={`Nueva contraseña de ${item.nombre_usuario}`}
                          autoComplete="new-password"
                          placeholder="Sin cambio"
                          value={borrador.contrasena}
                          onChange={(event) => cambiarBorrador(item.id_usuario, "contrasena", event.target.value)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="boton boton-oscuro"
                          disabled={guardando === item.id_usuario}
                          onClick={() => guardar(item.id_usuario)}
                        >
                          {guardando === item.id_usuario ? "Guardando…" : "Guardar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppLayout>
  );
}
