-- Migration 037: remove_seller_stock RPC
-- Atomicamente: lee con FOR UPDATE, elimina del seller_inventory, regresa stock al warehouse
-- Idempotente: segunda llamada encuentra NOT FOUND y retorna removed=0

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
