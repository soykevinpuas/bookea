-- Migration: 057_fix_stock_requests_admin_id
-- 1. Add admin_id to stock_requests
-- 2. Fix deliver_stock_request to use seller's assigned_admin_id
-- 3. Fix cancel_stock_request to restore to admin_stock

-- 1. Add admin_id column to stock_requests
ALTER TABLE public.stock_requests
ADD COLUMN admin_id UUID REFERENCES public.users(id);

CREATE INDEX idx_stock_requests_admin ON public.stock_requests(admin_id);

-- Backfill: set admin_id from seller's assigned_admin_id
UPDATE public.stock_requests sr
SET admin_id = u.assigned_admin_id
FROM public.users u
WHERE sr.seller_id = u.id
  AND sr.admin_id IS NULL
  AND u.assigned_admin_id IS NOT NULL;

-- 2. Fix create_stock_request: store admin_id on the request
CREATE OR REPLACE FUNCTION public.create_stock_request(
  p_seller_id UUID,
  p_notes TEXT,
  p_items JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id UUID;
  v_item JSONB;
  v_book RECORD;
  v_admin_id UUID;
  v_admin_qty INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autenticado');
  END IF;

  IF auth.uid() != p_seller_id THEN
    SELECT role INTO v_book FROM public.users WHERE id = auth.uid();
    IF v_book.role != 'admin' THEN
      RETURN json_build_object('success', false, 'error', 'No autorizado');
    END IF;
  END IF;

  SELECT assigned_admin_id INTO v_admin_id FROM public.users WHERE id = p_seller_id;

  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'El vendedor no tiene un administrador asignado');
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Debes incluir al menos un libro');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'quantity')::INT <= 0 THEN
      RETURN json_build_object('success', false, 'error', 'La cantidad debe ser mayor a 0');
    END IF;

    SELECT title INTO v_book FROM public.books WHERE id = (v_item->>'book_id')::UUID;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Libro no encontrado: ' || COALESCE(v_item->>'book_id', 'unknown'));
    END IF;

    SELECT quantity INTO v_admin_qty
    FROM public.admin_stock
    WHERE admin_id = v_admin_id AND book_id = (v_item->>'book_id')::UUID;

    IF v_admin_qty IS NULL OR v_admin_qty < (v_item->>'quantity')::INT THEN
      RETURN json_build_object('success', false, 'error', 'Stock insuficiente de "' || v_book.title || '" en el inventario de tu administrador. Disponible: ' || COALESCE(v_admin_qty::TEXT, '0'));
    END IF;
  END LOOP;

  INSERT INTO public.stock_requests (seller_id, notes, status, admin_id)
  VALUES (p_seller_id, NULLIF(p_notes, ''), 'pending', v_admin_id)
  RETURNING id INTO v_request_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.stock_request_items (request_id, book_id, quantity)
    VALUES (v_request_id, (v_item->>'book_id')::UUID, (v_item->>'quantity')::INT);
  END LOOP;

  RETURN json_build_object('success', true, 'request_id', v_request_id);
END;
$$;

-- 3. Fix deliver_stock_request: verify caller is the request's admin, use that admin's stock
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
  v_admin_id UUID;
  v_request RECORD;
  v_item RECORD;
  v_existing RECORD;
  v_new_qty INT;
  v_admin_qty INT;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT * INTO v_request FROM public.stock_requests WHERE id = p_request_id FOR UPDATE;

  IF v_request.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'La solicitud ya fue procesada');
  END IF;

  -- Only the request's assigned admin can deliver
  IF v_request.admin_id != v_admin_id THEN
    RETURN json_build_object('success', false, 'error', 'No eres el administrador asignado para esta solicitud');
  END IF;

  FOR v_item IN SELECT * FROM public.stock_request_items WHERE request_id = p_request_id
  LOOP
    UPDATE public.stock_request_items
    SET received_at = NOW()
    WHERE id = v_item.id AND received_at IS NULL;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Verificar y restar de admin_stock del admin de la solicitud
    SELECT quantity INTO v_admin_qty
    FROM public.admin_stock
    WHERE admin_id = v_admin_id AND book_id = v_item.book_id
    FOR UPDATE;

    IF v_admin_qty IS NULL OR v_admin_qty < v_item.quantity THEN
      RETURN json_build_object('success', false, 'error', 'Stock insuficiente en tu inventario para este libro. Necesitas: ' || v_item.quantity || ', tienes: ' || COALESCE(v_admin_qty::TEXT, '0'));
    END IF;

    UPDATE public.admin_stock
    SET quantity = quantity - v_item.quantity, updated_at = NOW()
    WHERE admin_id = v_admin_id AND book_id = v_item.book_id;

    -- Sumar a seller_inventory
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

-- 4. Fix cancel_stock_request: restore to admin_stock instead of books.stock_physical
CREATE OR REPLACE FUNCTION public.cancel_stock_request(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID;
  v_request RECORD;
  v_item RECORD;
  v_existing RECORD;
  v_remaining INT;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT * INTO v_request FROM public.stock_requests WHERE id = p_request_id FOR UPDATE;

  IF v_request.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  -- Only the request's assigned admin can cancel
  IF v_request.admin_id != v_admin_id THEN
    RETURN json_build_object('success', false, 'error', 'No eres el administrador asignado para esta solicitud');
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
            -- Restore to admin_stock instead of books.stock_physical
            INSERT INTO public.admin_stock (admin_id, book_id, quantity)
            VALUES (v_admin_id, v_item.book_id, v_remaining)
            ON CONFLICT (admin_id, book_id)
            DO UPDATE SET quantity = admin_stock.quantity + v_remaining, updated_at = NOW();
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
