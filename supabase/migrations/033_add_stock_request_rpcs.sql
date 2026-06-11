-- Migration 033: Atomic stock request delivery/cancellation RPCs
-- Eliminates partial-failure bug (H4) by wrapping all mutations in a single transaction

-- ============================================
-- deliver_stock_request: pending → delivered
-- Atomically: marks items received, decrements stock, upserts seller inventory
-- ============================================
CREATE OR REPLACE FUNCTION public.deliver_stock_request(
  p_request_id UUID,
  p_tracking_number TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_request RECORD;
  v_item RECORD;
  v_existing RECORD;
  v_new_qty INT;
BEGIN
  -- Lock and validate the request
  SELECT * INTO v_request FROM public.stock_requests WHERE id = p_request_id FOR UPDATE;

  IF v_request.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'La solicitud ya fue procesada');
  END IF;

  FOR v_item IN SELECT * FROM public.stock_request_items WHERE request_id = p_request_id
  LOOP
    -- Mark item as received (skip if already received)
    UPDATE public.stock_request_items
    SET received_at = NOW()
    WHERE id = v_item.id AND received_at IS NULL;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Decrement main stock (raises exception if insufficient)
    PERFORM public.decrement_stock(v_item.book_id, v_item.quantity);

    -- Upsert into seller_inventory
    SELECT * INTO v_existing FROM public.seller_inventory
    WHERE seller_id = v_request.seller_id AND book_id = v_item.book_id;

    IF v_existing.id IS NOT NULL THEN
      v_new_qty := v_existing.quantity + v_item.quantity;
      UPDATE public.seller_inventory
      SET quantity = v_new_qty, updated_at = NOW()
      WHERE id = v_existing.id;
    ELSE
      INSERT INTO public.seller_inventory (seller_id, book_id, quantity)
      VALUES (v_request.seller_id, v_item.book_id, v_item.quantity);
    END IF;
  END LOOP;

  -- Update request status
  UPDATE public.stock_requests
  SET status = 'delivered',
      updated_at = NOW(),
      tracking_number = COALESCE(p_tracking_number, tracking_number)
  WHERE id = p_request_id;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================
-- cancel_stock_request: delivered → cancelled
-- Atomically: restores main stock, removes from seller inventory
-- ============================================
CREATE OR REPLACE FUNCTION public.cancel_stock_request(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_request RECORD;
  v_item RECORD;
  v_existing RECORD;
  v_new_qty INT;
BEGIN
  SELECT * INTO v_request FROM public.stock_requests WHERE id = p_request_id FOR UPDATE;

  IF v_request.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  -- Only delivered requests need reversal
  IF v_request.status = 'delivered' THEN
    FOR v_item IN SELECT * FROM public.stock_request_items WHERE request_id = p_request_id
    LOOP
      -- Skip items that were never received
      IF v_item.received_at IS NOT NULL THEN
        -- Restore main stock
        PERFORM public.increment_stock(v_item.book_id, v_item.quantity);

        -- Remove from seller inventory
        SELECT * INTO v_existing FROM public.seller_inventory
        WHERE seller_id = v_request.seller_id AND book_id = v_item.book_id;

        IF v_existing.id IS NOT NULL THEN
          v_new_qty := v_existing.quantity - v_item.quantity;
          IF v_new_qty <= 0 THEN
            DELETE FROM public.seller_inventory WHERE id = v_existing.id;
          ELSE
            UPDATE public.seller_inventory
            SET quantity = v_new_qty, updated_at = NOW()
            WHERE id = v_existing.id;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.stock_requests
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_request_id;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
