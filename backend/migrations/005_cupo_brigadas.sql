-- Iteración 3: cupo mínimo y máximo de integrantes por brigada.
-- Aditiva e idempotente. Las brigadas existentes reciben 2 y 8 por defecto.

ALTER TABLE brigadas
    ADD COLUMN IF NOT EXISTS min_integrantes SMALLINT NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS max_integrantes SMALLINT NOT NULL DEFAULT 8;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brigadas_cupo_check') THEN
        ALTER TABLE brigadas ADD CONSTRAINT brigadas_cupo_check
            CHECK (min_integrantes >= 1 AND max_integrantes >= min_integrantes);
    END IF;
END $$;
