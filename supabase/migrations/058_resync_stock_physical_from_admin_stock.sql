-- Migration: 058_resync_stock_physical_from_admin_stock
-- Repara books.stock_physical para que coincida con la suma de admin_stock.
-- Útil tras separar inventario por admin o ajustes manuales en books.stock_physical.

UPDATE public.books b
SET stock_physical = COALESCE((
  SELECT SUM(a.quantity)
  FROM public.admin_stock a
  WHERE a.book_id = b.id
), 0);
