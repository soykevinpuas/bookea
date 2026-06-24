-- Migration 047: Audit Fixes for Seller Security
-- Resolves RLS bypasses and race conditions in seller system

-- 1. Remover políticas INSERT/UPDATE inseguras de seller_inventory
DROP POLICY IF EXISTS "Sellers update own inventory" ON public.seller_inventory;
DROP POLICY IF EXISTS "Sellers insert own inventory" ON public.seller_inventory;

-- 2. Remover política INSERT insegura de seller_sales
DROP POLICY IF EXISTS "Sellers insert own sales" ON public.seller_sales;

-- 3. Remover políticas INSERT inseguras de stock_requests y stock_request_items
DROP POLICY IF EXISTS "Sellers insert own requests" ON public.stock_requests;
DROP POLICY IF EXISTS "Sellers insert own request items" ON public.stock_request_items;

-- 4. Modificar sell_book para añadir FOR UPDATE y evitar race conditions
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

  -- FOR UPDATE bloquea la fila concurrente y previene el race condition
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

  INSERT INTO public.seller_sales (seller_id, book_id, quantity, sale_price)
  VALUES (p_seller_id, p_book_id, p_quantity, p_sale_price);

  UPDATE public.seller_inventory
  SET quantity = quantity - p_quantity, updated_at = NOW()
  WHERE id = v_inventory_id;

  RETURN json_build_object('success', true);
END;
$$;
