# Guía para los demás grupos

El módulo de usuarios ya deja la sesión lista. Cada grupo agrega su página y su API sin cambiar el login.

## Cómo levantarlo

En una terminal, desde `backend`:

```
.\venv\Scripts\Activate.ps1
flask run
```

En otra, desde `frontend`:

```
npm run dev
```

El front queda en `http://127.0.0.1:5173` y llama al back por `/api`. No suban `backend/.env`: ahí están la base y la clave de los tokens.

Las tablas ya existen en la base. No las vuelvan a crear. El esquema de referencia está en `database/schema/01_crear_tablas.sql`.

## Roles

El texto del rol es exacto: `ADMINISTRADOR`, `OPERADOR`, `BOMBERO`, `CIUDADANO`.

Hoy, al iniciar sesión, **todos** entran a `/cuenta`. El rol no cambia de página solo. `/usuarios` es la única pantalla reservada, y es solo para `ADMINISTRADOR`.

En el front el rol está en `usuario.rol`.

## Tokens

El login devuelve dos tokens. El de acceso dura 30 minutos y el de refresco 7 días. El navegador los guarda y el cliente de `frontend/src/api/client.js` manda el de acceso en cada petición:

```
Authorization: Bearer <access_token>
```

El token no trae el rol. Trae el id del usuario y una marca de la contraseña. En cada petición el servidor vuelve a leer al usuario: si la contraseña cambió, si la cuenta no está activa o si el token venció, responde 401 o 403. Cuando el acceso vence, el front usa el de refresco y pide otro par.

Usen la función `api()` de `frontend/src/api/client.js`. Ella pone el token y renueva la sesión. No armen un `fetch` aparte.

## Dónde va la página de cada grupo

Hacen falta tres sitios. Si falta uno, la pantalla se ve y la API no, o al revés.

1. **Ruta.** En `frontend/src/routes/AppRoutes.jsx`, dentro de `RutaPrivada`. Si el rol no coincide, redirijan a `/cuenta`. El modelo es la ruta `/usuarios`, que usa `soloAdmin`.
2. **Menú.** En `frontend/src/components/layout/AppLayout.jsx`, un enlace que solo se muestre si `usuario.rol` es el de ese grupo. Envuelvan la página con `AppLayout` para conservar la barra.
3. **API.** Un blueprint en `backend/app/routes/`, registrado en `backend/app/__init__.py` con prefijo `/api/...`. Protejan cada ruta con `@rol_requerido("BOMBERO")` (o el rol que corresponda), importado desde `app.middleware.auth`.

Si quieren que al entrar ese rol caiga directo en su página, cambien los dos destinos que hoy dicen `/cuenta`: el `navigate` de `frontend/src/pages/usuarios/LoginPage.jsx` y el `Navigate` de `RutaPublica` en `AppRoutes.jsx`. Elijan la ruta según `usuario.rol`.

## Qué no hay que romper

- No cambien `personas`, `roles` ni `usuarios` para guardar datos de otro módulo.
- Una contraseña nueva pide al menos 8 caracteres, una mayúscula, un número y un carácter especial. Las contraseñas que ya existen siguen sirviendo para entrar.
- El registro público solo crea ciudadanos. Las otras cuentas las crea un administrador.
- No impriman ni suban `DATABASE_URL` ni `SECRET_KEY`.

## Correo de recuperación

La recuperación de contraseña lee `backend/correo.env`. Créenlo y peguen exactamente este contenido:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=canchasrecuperar@gmail.com
SMTP_PASSWORD=wwiy vadd ousl dmwd
SMTP_FROM=canchasrecuperar@gmail.com
SMTP_USE_TLS=true
SMTP_USE_SSL=false
```
