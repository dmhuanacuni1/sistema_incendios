-- =============================================================================
-- SISTEMA DE GESTIÓN DE INCENDIOS FORESTALES
-- Esquema Completo de Base de Datos (PostgreSQL / Neon)
-- Basado en Modelo ER Chen + Entidad RECURSO
-- =============================================================================

-- Eliminar tablas en orden inverso a dependencias para despliegue limpio si se requiere
DROP TABLE IF EXISTS alerta_destinatarios CASCADE;
DROP TABLE IF EXISTS alertas CASCADE;
DROP TABLE IF EXISTS tipos_alerta CASCADE;
DROP TABLE IF EXISTS evaluaciones_danos CASCADE;
DROP TABLE IF EXISTS informes_bombero CASCADE;
DROP TABLE IF EXISTS incidente_brigadas CASCADE;
DROP TABLE IF EXISTS incidentes CASCADE;
DROP TABLE IF EXISTS avisos_incendio CASCADE;
DROP TABLE IF EXISTS brigada_miembros CASCADE;
DROP TABLE IF EXISTS brigadas CASCADE;
DROP TABLE IF EXISTS recursos CASCADE;
DROP TABLE IF EXISTS unidades CASCADE;
DROP TABLE IF EXISTS estaciones CASCADE;
DROP TABLE IF EXISTS zonas_riesgo CASCADE;
DROP TABLE IF EXISTS reportes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS personas CASCADE;

-- -----------------------------------------------------------------------------
-- 1. MÓDULO DE USUARIOS, PERSONAS Y ROLES (Iteración 1)
-- -----------------------------------------------------------------------------

CREATE TABLE personas (
    id_persona SERIAL PRIMARY KEY,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    correo VARCHAR(255),
    direccion VARCHAR(255),
    tipo_persona VARCHAR(50) DEFAULT 'CIUDADANO' CHECK (tipo_persona IN ('ADMINISTRADOR', 'OPERADOR', 'CIUDADANO', 'BOMBERO')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_personas_correo ON personas (lower(correo));

CREATE TABLE roles (
    id_rol SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    id_persona INT NOT NULL UNIQUE REFERENCES personas(id_persona) ON DELETE CASCADE,
    id_rol INT NOT NULL REFERENCES roles(id_rol) ON DELETE RESTRICT,
    nombre_usuario VARCHAR(50) NOT NULL UNIQUE,
    hash_contrasena VARCHAR(255) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO', 'BLOQUEADO')),
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 2. MÓDULO DE INFRAESTRUCTURA Y RECURSOS (Iteración 2)
-- -----------------------------------------------------------------------------

CREATE TABLE zonas_riesgo (
    id_zona SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    ubicacion TEXT NOT NULL,
    nivel_riesgo VARCHAR(20) NOT NULL CHECK (nivel_riesgo IN ('BAJO', 'MEDIO', 'ALTO', 'EXTREMO')),
    descripcion TEXT,
    id_administrador INT REFERENCES personas(id_persona) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE estaciones (
    id_estacion SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    id_administrador INT REFERENCES personas(id_persona) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE unidades (
    id_unidad SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    tipo VARCHAR(50) NOT NULL, -- Autobomba, Cisterna, Vehículo Rápido, Ambulancia
    capacidad VARCHAR(50),
    estado VARCHAR(30) NOT NULL DEFAULT 'DISPONIBLE' CHECK (estado IN ('DISPONIBLE', 'EN_MISION', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO')),
    motivo_estado TEXT,
    id_estacion INT NOT NULL REFERENCES estaciones(id_estacion) ON DELETE RESTRICT,
    id_administrador INT REFERENCES personas(id_persona) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- NUEVA ENTIDAD: RECURSO
-- Atributos: id_recurso, nombre, tipo_recurso (equipo, herramienta, insumo), cantidad, estado, motivo_estado.
-- Relación ESTACIÓN 1 — ALMACENA — N RECURSO
-- Relación ADMINISTRADOR 1 — GESTIONA — N RECURSO
CREATE TABLE recursos (
    id_recurso SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo_recurso VARCHAR(30) NOT NULL CHECK (tipo_recurso IN ('equipo', 'herramienta', 'insumo')),
    cantidad INT NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    estado VARCHAR(30) NOT NULL DEFAULT 'DISPONIBLE' CHECK (estado IN ('DISPONIBLE', 'EN_USO', 'AGOTADO', 'DANADO', 'MANTENIMIENTO', 'DE_BAJA')),
    motivo_estado TEXT,
    id_estacion INT NOT NULL REFERENCES estaciones(id_estacion) ON DELETE RESTRICT,
    id_administrador INT REFERENCES personas(id_persona) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 3. MÓDULO DE BRIGADAS Y BOMBEROS (Iteración 3)
-- -----------------------------------------------------------------------------

CREATE TABLE brigadas (
    id_brigada SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'EN_OPERACION', 'DESCANSO', 'DISUELTA')),
    motivo_estado TEXT,
    id_estacion INT NOT NULL REFERENCES estaciones(id_estacion) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE brigada_miembros (
    id_brigada_miembro SERIAL PRIMARY KEY,
    id_brigada INT NOT NULL REFERENCES brigadas(id_brigada) ON DELETE CASCADE,
    id_persona INT NOT NULL REFERENCES personas(id_persona) ON DELETE RESTRICT,
    rol_en_brigada VARCHAR(50) DEFAULT 'BOMBERO' CHECK (rol_en_brigada IN ('JEFE_CUADRILLA', 'BOMBERO', 'ESPECIALISTA', 'PARAMEDICO')),
    fecha_incorporacion DATE DEFAULT CURRENT_DATE,
    estado VARCHAR(20) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    UNIQUE (id_brigada, id_persona)
);

-- -----------------------------------------------------------------------------
-- 4. MÓDULO DE AVISOS E INCIDENTES (Iteraciones 4 y 5)
-- -----------------------------------------------------------------------------

CREATE TABLE avisos_incendio (
    id_aviso SERIAL PRIMARY KEY,
    id_ciudadano INT REFERENCES personas(id_persona) ON DELETE SET NULL,
    fecha_hora TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ubicacion TEXT NOT NULL,
    descripcion TEXT,
    nivel_urgencia VARCHAR(20) NOT NULL DEFAULT 'MEDIO' CHECK (nivel_urgencia IN ('BAJO', 'MEDIO', 'ALTO', 'CRITICO')),
    foto TEXT,
    estado_aviso VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado_aviso IN ('PENDIENTE', 'VERIFICADO', 'DESCARTADO', 'ATENDIDO')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incidentes (
    id_incidente SERIAL PRIMARY KEY,
    id_aviso INT REFERENCES avisos_incendio(id_aviso) ON DELETE SET NULL,
    id_operador INT REFERENCES personas(id_persona) ON DELETE SET NULL,
    id_zona INT REFERENCES zonas_riesgo(id_zona) ON DELETE SET NULL,
    fecha_inicio TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ubicacion TEXT NOT NULL,
    gravedad VARCHAR(20) NOT NULL DEFAULT 'MEDIA' CHECK (gravedad IN ('BAJA', 'MEDIA', 'ALTA', 'CATASTROFICA')),
    estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'CONTROLADO', 'EXTINGUIDO', 'CERRADO')),
    fecha_cierre TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incidente_brigadas (
    id_incidente INT NOT NULL REFERENCES incidentes(id_incidente) ON DELETE CASCADE,
    id_brigada INT NOT NULL REFERENCES brigadas(id_brigada) ON DELETE RESTRICT,
    fecha_asignacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    estado_asignacion VARCHAR(30) DEFAULT 'ASIGNADA' CHECK (estado_asignacion IN ('ASIGNADA', 'EN_CAMINO', 'EN_SITIO', 'LIBERADA')),
    PRIMARY KEY (id_incidente, id_brigada, fecha_asignacion)
);

CREATE TABLE informes_bombero (
    id_informe SERIAL PRIMARY KEY,
    id_incidente INT NOT NULL REFERENCES incidentes(id_incidente) ON DELETE CASCADE,
    id_bombero INT NOT NULL REFERENCES personas(id_persona) ON DELETE RESTRICT,
    fecha_hora TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    acciones TEXT NOT NULL,
    observaciones TEXT,
    evidencia TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE evaluaciones_danos (
    id_evaluacion SERIAL PRIMARY KEY,
    id_incidente INT NOT NULL UNIQUE REFERENCES incidentes(id_incidente) ON DELETE CASCADE,
    tipo_dano VARCHAR(100) NOT NULL,
    nivel_dano VARCHAR(20) NOT NULL CHECK (nivel_dano IN ('LEVE', 'MODERADO', 'SEVERO', 'TOTAL')),
    descripcion TEXT,
    costo_estimado NUMERIC(14, 2) DEFAULT 0.00,
    fecha_evaluacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 5. MÓDULO DE ALERTAS Y NOTIFICACIONES (Iteración 6)
-- -----------------------------------------------------------------------------

CREATE TABLE tipos_alerta (
    id_tipo_alerta SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    plantilla_mensaje TEXT NOT NULL
);

CREATE TABLE alertas (
    id_alerta SERIAL PRIMARY KEY,
    id_incidente INT REFERENCES incidentes(id_incidente) ON DELETE CASCADE,
    id_tipo_alerta INT NOT NULL REFERENCES tipos_alerta(id_tipo_alerta) ON DELETE RESTRICT,
    fecha_hora TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    mensaje TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alerta_destinatarios (
    id_alerta INT NOT NULL REFERENCES alertas(id_alerta) ON DELETE CASCADE,
    id_persona INT NOT NULL REFERENCES personas(id_persona) ON DELETE CASCADE,
    estado_envio VARCHAR(30) DEFAULT 'ENVIADO' CHECK (estado_envio IN ('PENDIENTE', 'ENVIADO', 'FALLIDO', 'ENTREGADO')),
    confirmada BOOLEAN DEFAULT FALSE,
    fecha_confirmacion TIMESTAMPTZ,
    PRIMARY KEY (id_alerta, id_persona)
);

-- -----------------------------------------------------------------------------
-- 6. MÓDULO DE REPORTES ADMINISTRATIVOS (Iteración 7)
-- -----------------------------------------------------------------------------

CREATE TABLE reportes (
    id_reporte SERIAL PRIMARY KEY,
    id_administrador INT REFERENCES personas(id_persona) ON DELETE SET NULL,
    tipo_reporte VARCHAR(100) NOT NULL,
    fecha_generacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    periodo VARCHAR(50) NOT NULL,
    formato VARCHAR(20) NOT NULL CHECK (formato IN ('PDF', 'EXCEL', 'CSV', 'JSON')),
    archivo_url TEXT
);

-- =============================================================================
-- ÍNDICES PARA RENDIMIENTO EN CONSULTAS FRECUENTES
-- =============================================================================
CREATE INDEX idx_usuarios_nombre_usuario ON usuarios(nombre_usuario);
CREATE INDEX idx_usuarios_rol ON usuarios(id_rol);
CREATE INDEX idx_recursos_estacion ON recursos(id_estacion);
CREATE INDEX idx_recursos_tipo ON recursos(tipo_recurso);
CREATE INDEX idx_unidades_estacion ON unidades(id_estacion);
CREATE INDEX idx_brigadas_estacion ON brigadas(id_estacion);
CREATE INDEX idx_incidentes_estado ON incidentes(estado);
CREATE INDEX idx_incidentes_zona ON incidentes(id_zona);
CREATE INDEX idx_avisos_estado ON avisos_incendio(estado_aviso);
CREATE INDEX idx_alertas_incidente ON alertas(id_incidente);
