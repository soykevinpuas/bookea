-- Migration 039: assign_stock RPC atómico
-- FOR UPDATE en seller_inventory y books, INSERT/UPDATE + decrement en una transacción

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
  -- Bloquear el registro del vendedor si existe
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

  -- Decrementar stock del warehouse (FOR UPDATE dentro del RPC)
  PERFORM public.decrement_stock(p_book_id, p_quantity);

  RETURN json_build_object('success', true, 'assigned', p_quantity);
END;
$$;
