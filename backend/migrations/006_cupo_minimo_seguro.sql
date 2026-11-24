-- Iteración 3: cupo operativo seguro y estricto.
-- Mínimo 5 (jefe + segundo jefe + 3 bomberos): cuadrilla forestal operativa.
-- Máximo 10 (control de mando; por encima se pierde coordinación).
-- Aditiva e idempotente; no agrega columnas, refuerza el CHECK y actualiza
-- los valores de las brigadas ya existentes.

ALTER TABLE brigadas DROP CONSTRAINT IF EXISTS brigadas_cupo_check;

ALTER TABLE brigadas ALTER COLUMN min_integrantes SET DEFAULT 5;
ALTER TABLE brigadas ALTER COLUMN max_integrantes SET DEFAULT 10;

UPDATE brigadas SET min_integrantes = 5, max_integrantes = 10;

ALTER TABLE brigadas ADD CONSTRAINT brigadas_cupo_check
    CHECK (
        min_integrantes >= 5
        AND max_integrantes >= min_integrantes
        AND max_integrantes <= 10
    );
