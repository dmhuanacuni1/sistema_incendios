-- Iteración 7: estadísticas e informes.
-- Migración aditiva y re-ejecutable: garantiza la existencia de las tablas del módulo
-- sin eliminar tablas, filas ni restricciones. En Neon ya están presentes, por lo que
-- esta ejecución es segura (no modifica datos).

CREATE TABLE IF NOT EXISTS reportes (
    id_reporte SERIAL PRIMARY KEY,
    id_administrador INT REFERENCES personas(id_persona) ON DELETE SET NULL,
    tipo_reporte VARCHAR(100) NOT NULL,
    fecha_generacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    periodo VARCHAR(50) NOT NULL,
    formato VARCHAR(20) NOT NULL CHECK (formato IN ('PDF', 'EXCEL', 'CSV', 'JSON')),
    archivo_url TEXT
);

CREATE TABLE IF NOT EXISTS archivos_reportes (
    id_reporte INTEGER PRIMARY KEY,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_mime VARCHAR(150) NOT NULL,
    contenido BYTEA NOT NULL,
    tamano_bytes BIGINT NOT NULL,

    CONSTRAINT fk_archivos_reportes
        FOREIGN KEY (id_reporte)
        REFERENCES reportes(id_reporte)
        ON DELETE CASCADE,

    CONSTRAINT chk_tamano_archivo
        CHECK (
            tamano_bytes > 0
            AND tamano_bytes = octet_length(contenido)
        )
);

CREATE TABLE IF NOT EXISTS contenido_reportes (
    id_reporte INTEGER PRIMARY KEY,
    datos JSONB NOT NULL,
    nombre_administrador VARCHAR(255) NOT NULL,
    version_contenido INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT fk_contenido_reportes
        FOREIGN KEY (id_reporte)
        REFERENCES reportes(id_reporte)
        ON DELETE CASCADE,

    CONSTRAINT chk_contenido_reportes_datos
        CHECK (jsonb_typeof(datos) = 'object'),

    CONSTRAINT chk_version_contenido
        CHECK (version_contenido > 0)
);

CREATE INDEX IF NOT EXISTS idx_reportes_fecha_generacion
    ON reportes (fecha_generacion DESC);
