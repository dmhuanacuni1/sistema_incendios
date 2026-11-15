import { Link } from "react-router-dom";

const FOTO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Creeping_Flames_through_the_Ponderosa_Forest_%2854210807661%29.jpg/1920px-Creeping_Flames_through_the_Ponderosa_Forest_%2854210807661%29.jpg";

const SABER = [
  {
    id: "aviso",
    titulo: "Entras con tu cuenta",
    texto: "Para avisar necesitas un usuario. Si no tienes, crea una cuenta: el registro público te deja como ciudadano. Si ya tienes, inicia sesión.",
  },
  {
    id: "incidente",
    titulo: "Di lo que estás viendo",
    texto: "Humo, llamas o los dos. Desde cuándo lo notas y si crece. No hace falta el nombre técnico: describe lo que tienes delante.",
  },
  {
    id: "zona",
    titulo: "Marca el lugar",
    texto: "Calle, camino, cerro o una referencia que se pueda encontrar. Mientras más preciso sea el punto, antes se ubica el humo.",
  },
  {
    id: "alerta",
    titulo: "Di qué tan urgente se ve",
    texto: "Si hay casas, gente, animales o el fuego ya corta un camino, dilo. Si el humo se ve lejos, dilo también: igual sirve.",
  },
  {
    id: "recurso",
    titulo: "No te acerques",
    texto: "No bajes al fuego para mirar mejor ni intentes apagarlo si ya pasó de un foco chico. Aléjate, deja libre el camino y avisa.",
  },
  {
    id: "brigada",
    titulo: "Tu aviso queda escrito",
    texto: "No se pierde en una llamada. Queda con hora y lugar para que lo revisen. Tú no organizas la salida: con avisar cumples tu parte.",
  },
];

const ANTES = [
  ["El punto", "Dónde estás y hacia qué lado se ve el humo o el fuego."],
  ["El viento", "Si corre y hacia dónde. El humo se mueve con él."],
  ["Quién está cerca", "Personas, casas o animales. Eso cambia la urgencia."],
  ["Cómo contactarte", "Un teléfono, por si necesitan preguntarte un dato que faltó."],
];

function IconoArea({ tipo }) {
  return (
    <span className="icono-area" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22">
        {tipo === "aviso" && (
          <>
            <circle cx="12" cy="8" r="2.2" />
            <path d="M6.2 18.6c1.1-2.6 3-3.9 5.8-3.9s4.7 1.3 5.8 3.9" />
          </>
        )}
        {tipo === "incidente" && (
          <path d="M12 3.5c.6 2.4 2.6 3.5 2.6 6a2.6 2.6 0 0 1-5.2 0c0-1.2.7-2.1 1.3-3.1-1 1.1-2.4 2.1-2.4 4.4A3.7 3.7 0 0 0 12 18.2a3.7 3.7 0 0 0 3.7-7.4C15.7 7.2 13.6 5.4 12 3.5z" />
        )}
        {tipo === "brigada" && (
          <>
            <path d="M7 4.5h7l3 3V19.5H7z" />
            <path d="M14 4.5V8h3" />
            <path d="M9.5 12.2h5" />
            <path d="M9.5 15.2h5" />
          </>
        )}
        {tipo === "recurso" && (
          <>
            <path d="M12 4.2 20 19H4L12 4.2z" />
            <path d="M12 10v4.2" />
            <path d="M12 16.6h.01" />
          </>
        )}
        {tipo === "zona" && (
          <>
            <path d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10z" />
            <circle cx="12" cy="11" r="1.7" />
          </>
        )}
        {tipo === "alerta" && (
          <>
            <path d="M6 16.5h12l-1.3-2.1V10a4.7 4.7 0 0 0-9.4 0v4.4L6 16.5z" />
            <path d="M10 16.5a2 2 0 0 0 4 0" />
          </>
        )}
      </svg>
    </span>
  );
}

export default function InicioPage() {
  return (
    <div className="portada">
      <header className="cabecera-publica">
        <Link to="/" className="nombre-sitio">Sistema de incendios</Link>
        <Link to="/login" className="boton-entrada">Iniciar sesión</Link>
      </header>

      <section className="hero-portada">
        <img
          src={FOTO}
          alt="Llamas bajas avanzando entre pinos en un bosque"
          decoding="async"
          fetchPriority="high"
        />
        <div className="hero-texto">
          <h1>Si ves humo, avisa.</h1>
          <p>
            Esta página es para quien está en el territorio.
            Entra o crea tu cuenta de ciudadano y deja constancia de lo que ves.
          </p>
        </div>
      </section>

      <section className="franja-portada">
        <h2>Lo que debes saber</h2>
        <p className="lead-portada">
          No hace falta saber de incendios. Sí hace falta contar lo que tienes delante,
          con calma y sin acercarte. Si aún no tienes usuario,{" "}
          <Link to="/registro">crea una cuenta</Link>.
        </p>
        <ul className="mapa-sistema">
          {SABER.map((item) => (
            <li key={item.id}>
              <IconoArea tipo={item.id} />
              <strong>{item.titulo}</strong>
              <span>{item.texto}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="franja-portada franja-clara">
        <h2>Antes de enviar el aviso</h2>
        <p className="lead-portada">
          Ten estos datos a mano. Si te falta uno, envía igual lo que sepas:
          un aviso incompleto sirve más que el silencio.
        </p>
        <ol className="roles-portada">
          {ANTES.map(([titulo, texto]) => (
            <li key={titulo}>
              <strong>{titulo}</strong>
              <span>{texto}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="pie-portada">
        <p>© 2026 Sistema de incendios forestales</p>
      </footer>
    </div>
  );
}
