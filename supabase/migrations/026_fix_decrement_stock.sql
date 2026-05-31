-- Migration: 026_fix_decrement_stock.sql
-- Bookea - Fix decrement_stock to raise exception on insufficient stock
-- Created: Mayo 2026

CREATE OR REPLACE FUNCTION public.decrement_stock(p_book_id UUID, p_quantity INT DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stock INT;
BEGIN
  SELECT stock_physical INTO current_stock FROM books WHERE id = p_book_id;

  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Libro no encontrado';
  END IF;

  IF current_stock < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %, solicitado: %', current_stock, p_quantity;
  END IF;

  UPDATE books SET stock_physical = stock_physical - p_quantity
  WHERE id = p_book_id;
END;
$$;
