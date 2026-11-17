import { Link, Outlet, useLocation } from "react-router-dom";
import paisaje from "../../assets/im_incendio2.webp";

function IconoUsuario() {
  return (
    <div className="icono-usuario" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="32" height="32">
        <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M5.2 19.2c1.5-3.1 3.7-4.6 6.8-4.6s5.3 1.5 6.8 4.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default function MarcoAcceso() {
  const { pathname } = useLocation();
  const esRegistro = pathname === "/registro";
  const esRecuperar = pathname === "/recuperar";
  const esRestablecer = pathname.startsWith("/restablecer");
  const titulo = esRegistro
    ? "Crear cuenta"
    : esRecuperar
      ? "Recuperar contraseña"
      : esRestablecer
        ? "Nueva contraseña"
        : "Iniciar sesión";
  const bajada = esRegistro
    ? "El registro público crea una cuenta de ciudadano."
    : esRecuperar
      ? "Escribe el correo de tu cuenta. Si está registrado, te llega un enlace."
      : esRestablecer
        ? "Elige una contraseña nueva. El enlace vence en una hora."
        : "Entra con tu usuario para reportar un aviso o continuar en el sistema.";

  return (
    <main className="lienzo">
      <Link to="/" className="boton-volver" aria-label="Volver a la página principal">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M14.5 6 L8.5 12 L14.5 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
      <section className="tarjeta">
        <div className="tarjeta-form">
          <div
            key={pathname}
            className={`bloque-form ${esRegistro ? "vista-registro" : "vista-login"}`}
          >
            <IconoUsuario />
            <h1>{titulo}</h1>
            <p className="bajada">{bajada}</p>
            <Outlet />
            <p className="pie-acceso">
              {esRegistro || esRecuperar || esRestablecer ? (
                <>
                  ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
                </>
              ) : (
                <>
                  ¿No tienes cuenta? <Link to="/registro">Crear una</Link>
                </>
              )}
            </p>
          </div>
        </div>
        <aside className={`tarjeta-arte ${esRegistro ? "arte-registro" : "arte-login"}`}>
          <img className="foto-borde" src={paisaje} alt="" aria-hidden="true" decoding="async" />
          <img className="foto-nitida" src={paisaje} alt="Persona frente a un incendio" decoding="async" fetchPriority="high" />
          <div className="arte-texto">
            <h2>Cuando el monte arde,<br />cada minuto cuenta</h2>
            <p>Reporta, coordina y protege el territorio.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
