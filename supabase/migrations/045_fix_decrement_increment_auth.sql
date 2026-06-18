-- 045 - Remover auth check de decrement_stock e increment_stock
-- Son RPCs utilitarios internos llamados desde deliver/assign/cancel RPCs (ya con auth)
-- y desde el webhook de Stripe (donde no hay sesión de usuario).
-- La proteccion real está en los RPCs que los invocan.

-- ============================================================
-- decrement_stock — sin auth check (RPC interno)
-- Conserva: FOR UPDATE, SET search_path = '', validación stock_insuficiente
-- ============================================================
CREATE OR REPLACE FUNCTION public.decrement_stock(p_book_id UUID, p_quantity INT DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_stock INT;
BEGIN
  SELECT stock_physical INTO current_stock FROM public.books WHERE id = p_book_id FOR UPDATE;

  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Libro no encontrado';
  END IF;

  IF current_stock < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %, solicitado: %', current_stock, p_quantity;
  END IF;

  UPDATE public.books SET stock_physical = stock_physical - p_quantity
  WHERE id = p_book_id;
END;
$$;

-- ============================================================
-- increment_stock — sin auth check (RPC interno)
-- Conserva: SET search_path = ''
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_stock(p_book_id UUID, p_quantity INT DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.books SET stock_physical = stock_physical + p_quantity
  WHERE id = p_book_id;
END;
$$;
