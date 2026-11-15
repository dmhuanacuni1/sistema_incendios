# Sistema de Incendios

Proyecto académico para la gestión de incendios forestales. Backend **Flask + PostgreSQL**,
frontend **React**, arquitectura **MVC** y desarrollo por iteraciones.

> **Estado actual:** el sprint de usuarios está implementado (acceso, registro de ciudadano, sesión y administración de cuentas). Los demás módulos tienen sus tablas en la base y todavía no tienen pantallas. La guía corta para continuar está en `GUIA_GRUPOS.md`.

## Estructura

```
sistema_incendios/
├─ backend/                  # Flask (Modelo + Controlador + contrato de Vista)
│  ├─ app/
│  │  ├─ config/             # configuración y conexión a PostgreSQL
│  │  ├─ models/             # MODELO: entidades y tablas
│  │  ├─ controllers/        # CONTROLADOR: lógica de cada módulo
│  │  ├─ views/              # VISTA (backend): serialización y respuestas JSON
│  │  ├─ routes/             # endpoints / blueprints por módulo
│  │  ├─ services/           # lógica de negocio reutilizable
│  │  ├─ middleware/         # autenticación, roles, validaciones
│  │  └─ utils/              # helpers
│  ├─ migrations/            # cambios de esquema versionados
│  ├─ tests/                 # pruebas
│  ├─ venv/                  # entorno virtual (no se versiona)
│  ├─ requirements.txt
│  └─ .env.example
├─ frontend/                 # React
│  ├─ public/
│  └─ src/
│     ├─ api/                # cliente HTTP y estrategia de refresco
│     ├─ components/         # common/ y layout/
│     ├─ pages/              # una carpeta por iteración
│     ├─ hooks/              # hooks (incluido el de refresco)
│     ├─ context/            # estado global / sesión
│     ├─ routes/             # rutas de la aplicación
│     ├─ services/           # acceso a datos por módulo
│     ├─ styles/
│     └─ assets/
├─ database/
│  ├─ schema/                # DDL de referencia
│  ├─ seeds/                 # datos de prueba
│  └─ backups/
├─ .env.local                # variables de Neon (NO se sube a git)
├─ .neon                     # vínculo con el proyecto de Neon
└─ .gitignore
```

## Iteraciones

1. Gestión de usuarios
2. Gestión de recursos y estaciones
3. Gestión de brigadas
4. Gestión de zonas de riesgo
5. Gestión de incidentes
6. Gestión de alertas y notificaciones
7. Gestión de estadísticas e informes
