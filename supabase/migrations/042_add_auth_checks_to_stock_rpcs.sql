-- 042 - Agregar auth checks a RPCs de stock que carecían de ellos
-- Todos son SECURITY DEFINER y cualquier usuario autenticado podía llamarlos

-- ============================================================
-- remove_seller_stock
-- ============================================================
CREATE OR REPLACE FUNCTION public.remove_seller_stock(
  p_seller_id UUID,
  p_book_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_qty INT;
  v_inventory_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT id, quantity INTO v_inventory_id, v_current_qty
  FROM public.seller_inventory
  WHERE seller_id = p_seller_id AND book_id = p_book_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', true, 'removed', 0);
  END IF;

  DELETE FROM public.seller_inventory WHERE id = v_inventory_id;

  UPDATE public.books
  SET stock_physical = stock_physical + v_current_qty
  WHERE id = p_book_id;

  RETURN json_build_object('success', true, 'removed', v_current_qty);
END;
$$;

-- ============================================================
-- revert_assign_stock
-- ============================================================
CREATE OR REPLACE FUNCTION public.revert_assign_stock(
  p_seller_id UUID,
  p_book_id UUID,
  p_quantity INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_qty INT;
  v_inventory_id UUID;
  v_new_qty INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT id, quantity INTO v_inventory_id, v_current_qty
  FROM public.seller_inventory
  WHERE seller_id = p_seller_id AND book_id = p_book_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'No hay inventario asignado');
  END IF;

  v_new_qty := v_current_qty - p_quantity;

  IF v_new_qty <= 0 THEN
    DELETE FROM public.seller_inventory WHERE id = v_inventory_id;
  ELSE
    UPDATE public.seller_inventory
    SET quantity = v_new_qty, updated_at = NOW()
    WHERE id = v_inventory_id;
  END IF;

  UPDATE public.books
  SET stock_physical = stock_physical + p_quantity
  WHERE id = p_book_id;

  RETURN json_build_object('success', true, 'removed', p_quantity);
END;
$$;

-- ============================================================
-- assign_stock
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_stock(
  p_seller_id UUID,
  p_book_id UUID,
  p_quantity INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inventory_id UUID;
  v_current_qty INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT id, quantity INTO v_inventory_id, v_current_qty
  FROM public.seller_inventory
  WHERE seller_id = p_seller_id AND book_id = p_book_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.seller_inventory
    SET quantity = v_current_qty + p_quantity, updated_at = NOW()
    WHERE id = v_inventory_id;
  ELSE
    INSERT INTO public.seller_inventory (seller_id, book_id, quantity)
    VALUES (p_seller_id, p_book_id, p_quantity);
  END IF;

  PERFORM public.decrement_stock(p_book_id, p_quantity);

  RETURN json_build_object('success', true, 'assigned', p_quantity);
END;
$$;

-- ============================================================
-- delete_sale_and_restore_stock
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_sale_and_restore_stock(
  p_sale_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sale RECORD;
  v_inventory_id UUID;
  v_current_qty INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT seller_id, book_id, quantity INTO v_sale
  FROM public.seller_sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venta no encontrada');
  END IF;

  DELETE FROM public.seller_sales WHERE id = p_sale_id;

  SELECT id, quantity INTO v_inventory_id, v_current_qty
  FROM public.seller_inventory
  WHERE seller_id = v_sale.seller_id AND book_id = v_sale.book_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.seller_inventory
    SET quantity = v_current_qty + v_sale.quantity, updated_at = NOW()
    WHERE id = v_inventory_id;
  ELSE
    INSERT INTO public.seller_inventory (seller_id, book_id, quantity)
    VALUES (v_sale.seller_id, v_sale.book_id, v_sale.quantity);
  END IF;

  RETURN json_build_object('success', true, 'restored', v_sale.quantity);
END;
$$;
