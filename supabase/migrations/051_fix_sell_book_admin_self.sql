-- Migration: 051_fix_sell_book_admin_self
-- Cuando un admin vende como seller (sin assigned_admin_id),
-- se atribuye la venta a sí mismo para que aparezca en sus métricas

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
  v_admin_id UUID;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Cantidad inválida');
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

  -- Si el vendedor no tiene admin asignado (ej. admin vendiendo), se atribuye a sí mismo
  SELECT COALESCE(assigned_admin_id, p_seller_id) INTO v_admin_id
  FROM public.users
  WHERE id = p_seller_id;

  SELECT id, quantity INTO v_inventory_id, v_current_qty
  FROM public.seller_inventory
  WHERE seller_id = p_seller_id AND book_id = p_book_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Libro no encontrado en tu inventario');
  END IF;

  IF v_current_qty < p_quantity THEN
    RETURN json_build_object('success', false, 'error', 'Stock insuficiente');
  END IF;

  INSERT INTO public.seller_sales (seller_id, book_id, quantity, sale_price, admin_id)
  VALUES (p_seller_id, p_book_id, p_quantity, p_sale_price, v_admin_id);

  UPDATE public.seller_inventory
  SET quantity = quantity - p_quantity, updated_at = NOW()
  WHERE id = v_inventory_id;

  RETURN json_build_object('success', true);
END;
$$;
