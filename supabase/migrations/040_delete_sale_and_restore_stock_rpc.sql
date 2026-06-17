-- Migration 040: delete_sale_and_restore_stock RPC atómico
-- DELETE de seller_sales + FOR UPDATE en seller_inventory + UPDATE/INSERT en una transacción

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
  -- Leer la venta (con FOR UPDATE para evitar condiciones de carrera)
  SELECT seller_id, book_id, quantity INTO v_sale
  FROM public.seller_sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venta no encontrada');
  END IF;

  -- Eliminar la venta
  DELETE FROM public.seller_sales WHERE id = p_sale_id;

  -- Restaurar stock al vendedor (con FOR UPDATE)
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
