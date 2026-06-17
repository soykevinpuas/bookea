-- Migration 038: revert_assign_stock RPC + fix increment_stock FOR UPDATE
-- Atomicamente: FOR UPDATE, decrementa/elimina seller_inventory, regresa stock al warehouse

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
