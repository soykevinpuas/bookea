-- 041 - Prevenir duplicados de monedas por libro+fuente
-- Evita TOCTOU: dos procesos concurrentes no pueden otorgar moneda 2 veces

-- Limpiar duplicados existentes: mantener solo el registro más antiguo por (user_id, book_id, source)
DELETE FROM coin_transactions
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY user_id, book_id, source ORDER BY created_at ASC
    ) AS rn
    FROM coin_transactions
  ) AS dups
  WHERE dups.rn > 1
);

ALTER TABLE coin_transactions
DROP CONSTRAINT IF EXISTS coin_transactions_user_book_source_key;

ALTER TABLE coin_transactions
ADD CONSTRAINT coin_transactions_user_book_source_key
UNIQUE (user_id, book_id, source);
