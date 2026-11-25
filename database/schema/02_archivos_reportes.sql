-- =====================================================
-- SISTEMA VIGIA TERRITORIAL
-- Iteracion 7: Estadisticas e informes
-- Archivo: 02_archivos_reportes.sql
-- Motor: PostgreSQL (Neon)
-- =====================================================

-- Objetivo:
-- Almacenar los documentos originales PDF y Excel
-- generados por el modulo de estadisticas e informes.
--
-- Requisito previo:
-- La tabla public.reportes debe existir.
--
-- IMPORTANTE:
-- Esta tabla ya fue creada en la base de datos
-- compartida de Neon con autorizacion del equipo.
-- No ejecutar nuevamente en dicha base de datos.

BEGIN;

CREATE TABLE public.archivos_reportes (
    id_reporte INTEGER PRIMARY KEY,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_mime VARCHAR(150) NOT NULL,
    contenido BYTEA NOT NULL,
    tamano_bytes BIGINT NOT NULL,

    CONSTRAINT fk_archivos_reportes
        FOREIGN KEY (id_reporte)
        REFERENCES public.reportes(id_reporte)
        ON DELETE CASCADE,

    CONSTRAINT chk_tamano_archivo
        CHECK (
            tamano_bytes > 0
            AND tamano_bytes = octet_length(contenido)
        )
);

COMMIT;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================