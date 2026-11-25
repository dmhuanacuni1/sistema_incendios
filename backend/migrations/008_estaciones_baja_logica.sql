-- Baja lógica de estaciones: mantener la fila y registrar si está operativa.
-- Migración aditiva y re-ejecutable: NO elimina tablas, columnas ni filas.
-- Las estaciones existentes quedan ACTIVA por el valor por defecto.

ALTER TABLE public.estaciones
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conrelid = 'public.estaciones'::regclass
           AND conname = 'chk_estaciones_estado'
    ) THEN
        ALTER TABLE public.estaciones
            ADD CONSTRAINT chk_estaciones_estado
            CHECK (estado IN ('ACTIVA', 'DE_BAJA'));
    END IF;
END $$;

ALTER TABLE public.estaciones
    ADD COLUMN IF NOT EXISTS motivo_baja TEXT;

ALTER TABLE public.estaciones
    ADD COLUMN IF NOT EXISTS fecha_baja TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_estaciones_estado
    ON public.estaciones (estado);
