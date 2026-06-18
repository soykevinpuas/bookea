-- 044 - Fixes finales al flujo de stock:
--   1. assign_stock_batch RPC (operación atómica para múltiples books)
--   2. Input validation en assign_stock, revert_assign_stock, remove_seller_stock
--   3. CHECK (quantity > 0) en stock_request_items
--   4. SET search_path = '' en deliver/cancel_stock_request
--   5. Remover 'shipped' del CHECK de stock_requests (estado muerto)
--   6. Composite index para seller_inventory(seller_id, book_id)

-- ============================================================
-- 1. assign_stock_batch: asigna múltiples books atómicamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_stock_batch(
  p_seller_id UUID,
  p_items JSONB  -- [{"book_id": "uuid", "quantity": int}, ...]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item JSONB;
  v_book_id UUID;
  v_quantity INT;
  v_inventory_id UUID;
  v_current_qty INT;
  v_assigned INT := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No hay items para asignar');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_book_id := (v_item->>'book_id')::UUID;
    v_quantity := (v_item->>'quantity')::INT;

    IF v_quantity <= 0 THEN
      RETURN json_build_object('success', false, 'error', 'Cantidad inválida para book_id: ' || v_book_id);
    END IF;

    SELECT id, quantity INTO v_inventory_id, v_current_qty
    FROM public.seller_inventory
    WHERE seller_id = p_seller_id AND book_id = v_book_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.seller_inventory
      SET quantity = v_current_qty + v_quantity, updated_at = NOW()
      WHERE id = v_inventory_id;
    ELSE
      INSERT INTO public.seller_inventory (seller_id, book_id, quantity)
      VALUES (p_seller_id, v_book_id, v_quantity);
    END IF;

    PERFORM public.decrement_stock(v_book_id, v_quantity);

    v_assigned := v_assigned + v_quantity;
  END LOOP;

  RETURN json_build_object('success', true, 'assigned', v_assigned);
END;
$$;

-- ============================================================
-- 2. Input validation en assign_stock
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

  IF p_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Cantidad inválida');
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
-- 3. Input validation en revert_assign_stock
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

  IF p_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Cantidad inválida');
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
-- 4. Input validation en remove_seller_stock
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

  IF p_seller_id IS NULL OR p_book_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Parámetros inválidos');
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
-- 5. Fix search_path en deliver_stock_request y cancel_stock_request
--    (estaban con 'public' en vez de '')
-- ============================================================
CREATE OR REPLACE FUNCTION public.deliver_stock_request(
  p_request_id UUID,
  p_tracking_number TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request RECORD;
  v_item RECORD;
  v_existing RECORD;
  v_new_qty INT;
BEGIN
  IF auth.uid() IS NULL OR (SELECT role FROM public.users WHERE id = auth.uid()) != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT * INTO v_request FROM public.stock_requests WHERE id = p_request_id FOR UPDATE;

  IF v_request.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'La solicitud ya fue procesada');
  END IF;

  FOR v_item IN SELECT * FROM public.stock_request_items WHERE request_id = p_request_id
  LOOP
    UPDATE public.stock_request_items
    SET received_at = NOW()
    WHERE id = v_item.id AND received_at IS NULL;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    PERFORM public.decrement_stock(v_item.book_id, v_item.quantity);

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

CREATE OR REPLACE FUNCTION public.cancel_stock_request(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request RECORD;
  v_item RECORD;
  v_existing RECORD;
  v_remaining INT;
BEGIN
  IF auth.uid() IS NULL OR (SELECT role FROM public.users WHERE id = auth.uid()) != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT * INTO v_request FROM public.stock_requests WHERE id = p_request_id FOR UPDATE;

  IF v_request.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_request.status = 'delivered' THEN
    FOR v_item IN SELECT * FROM public.stock_request_items WHERE request_id = p_request_id
    LOOP
      IF v_item.received_at IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.seller_inventory
        WHERE seller_id = v_request.seller_id AND book_id = v_item.book_id;

        IF v_existing.id IS NOT NULL THEN
          v_remaining := LEAST(v_existing.quantity, v_item.quantity);
          IF v_remaining > 0 THEN
            PERFORM public.increment_stock(v_item.book_id, v_remaining);
          END IF;

          IF v_existing.quantity <= v_item.quantity THEN
            DELETE FROM public.seller_inventory WHERE id = v_existing.id;
          ELSE
            UPDATE public.seller_inventory
            SET quantity = quantity - v_item.quantity, updated_at = NOW()
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

-- ============================================================
-- 6. Remover 'shipped' del CHECK de stock_requests (estado muerto)
-- ============================================================
ALTER TABLE public.stock_requests DROP CONSTRAINT IF EXISTS stock_requests_status_check;
ALTER TABLE public.stock_requests ADD CONSTRAINT stock_requests_status_check
  CHECK (status IN ('pending', 'delivered', 'cancelled'));

-- ============================================================
-- 7. CHECK (quantity > 0) en stock_request_items
-- ============================================================
ALTER TABLE public.stock_request_items DROP CONSTRAINT IF EXISTS stock_request_items_qty_positive;
ALTER TABLE public.stock_request_items ADD CONSTRAINT stock_request_items_qty_positive CHECK (quantity > 0);

-- ============================================================
-- 8. Composite index para seller_inventory(seller_id, book_id)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_seller_inventory_seller_book
  ON public.seller_inventory(seller_id, book_id);
