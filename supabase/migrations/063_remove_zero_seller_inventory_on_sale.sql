-- Migration: 063_remove_zero_seller_inventory_on_sale
-- Keep seller_inventory as active stock only. Sales that exhaust a title now
-- delete the inventory row instead of leaving quantity = 0, which confused
-- admin inventory counters.

CREATE OR REPLACE FUNCTION public.sell_book(
  p_seller_id UUID,
  p_book_id UUID,
  p_quantity INT,
  p_sale_price NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inventory_id UUID;
  v_current_qty INT;
  v_new_qty INT;
  v_admin_id UUID;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Cantidad invalida');
  END IF;

  IF p_sale_price <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'El precio de venta debe ser mayor a 0');
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autenticado');
  END IF;

  IF auth.uid() != p_seller_id THEN
    RETURN json_build_object('success', false, 'error', 'No tienes permiso para vender como este vendedor');
  END IF;

  SELECT assigned_admin_id INTO v_admin_id
  FROM public.users
  WHERE id = p_seller_id;

  SELECT id, quantity INTO v_inventory_id, v_current_qty
  FROM public.seller_inventory
  WHERE seller_id = p_seller_id
    AND book_id = p_book_id
    AND quantity > 0
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Libro no encontrado en tu inventario');
  END IF;

  IF v_current_qty < p_quantity THEN
    RETURN json_build_object('success', false, 'error', 'Stock insuficiente');
  END IF;

  INSERT INTO public.seller_sales (seller_id, book_id, quantity, sale_price, admin_id)
  VALUES (p_seller_id, p_book_id, p_quantity, p_sale_price, v_admin_id);

  v_new_qty := v_current_qty - p_quantity;

  IF v_new_qty <= 0 THEN
    DELETE FROM public.seller_inventory
    WHERE id = v_inventory_id;
  ELSE
    UPDATE public.seller_inventory
    SET quantity = v_new_qty, updated_at = NOW()
    WHERE id = v_inventory_id;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

DELETE FROM public.seller_inventory
WHERE quantity <= 0;
