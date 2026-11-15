import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function AppLayout({ children, ancha = false, suelta = false }) {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function salir() {
    cerrarSesion();
    navigate("/login", { replace: true });
  }

  function enlace(ruta, texto) {
    if (pathname === ruta) return <span aria-current="page">{texto}</span>;
    return <Link to={ruta}>{texto}</Link>;
  }

  return (
    <main className={`cuenta${ancha ? " cuenta-ancha" : ""}`}>
      <header className="cuenta-barra">
        <Link to="/" className="cuenta-marca">Sistema de incendios</Link>
        {usuario && (
          <nav className="cuenta-nav">
            {enlace("/cuenta", "Mi cuenta")}
            {usuario.rol === "ADMINISTRADOR" && enlace("/usuarios", "Usuarios")}
            <button type="button" className="boton boton-oscuro" onClick={salir}>
              Salir
            </button>
          </nav>
        )}
      </header>
      {suelta ? (
        <div className="cuenta-pila">{children}</div>
      ) : (
        <section className={`cuenta-tarjeta${ancha ? " cuenta-tarjeta-ancha" : ""}`}>
          {children}
        </section>
      )}
    </main>
  );
}
