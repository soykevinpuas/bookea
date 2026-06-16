-- Migration 036: Fix race conditions, over-restore, add CHECK constraints, add auth checks
-- Fixes:
--   1. Add FOR UPDATE to decrement_stock (race condition)
--   2. Add auth check to deliver_stock_request
--   3. Fix cancel_stock_request over-restore after partial sales
--   4. Add FOR UPDATE to sell_book RPC
--   5. CHECK constraints on books.stock_physical >= 0 and seller_inventory.quantity >= 0

-- ============================================
-- 1. Fix decrement_stock: add FOR UPDATE to prevent race condition
-- ============================================
CREATE OR REPLACE FUNCTION public.decrement_stock(p_book_id UUID, p_quantity INT DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stock INT;
BEGIN
  SELECT stock_physical INTO current_stock FROM public.books WHERE id = p_book_id FOR UPDATE;

  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Libro no encontrado';
  END IF;

  IF current_stock < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %, solicitado: %', current_stock, p_quantity;
  END IF;

  UPDATE public.books SET stock_physical = stock_physical - p_quantity
  WHERE id = p_book_id;
END;
$$;

-- ============================================
-- 2. Fix deliver_stock_request: add auth check
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
  -- Auth check: only admins can deliver
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

-- ============================================
-- 3. Fix cancel_stock_request: only restore unsold stock, not full requested qty
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
  v_remaining INT;
BEGIN
  -- Auth check: only admins can cancel
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
        -- Get current seller inventory for this book
        SELECT * INTO v_existing FROM public.seller_inventory
        WHERE seller_id = v_request.seller_id AND book_id = v_item.book_id;

        IF v_existing.id IS NOT NULL THEN
          -- Only restore what's still in inventory (unsold portion)
          v_remaining := LEAST(v_existing.quantity, v_item.quantity);
          IF v_remaining > 0 THEN
            PERFORM public.increment_stock(v_item.book_id, v_remaining);
          END IF;

          -- Remove from seller inventory
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

-- ============================================
-- 4. Fix sell_book: add FOR UPDATE to prevent race condition
-- ============================================
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

-- ============================================
-- 5. Add CHECK constraints to prevent negative stock
-- ============================================
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_stock_positive;
ALTER TABLE public.books ADD CONSTRAINT books_stock_positive CHECK (stock_physical >= 0);

ALTER TABLE public.seller_inventory DROP CONSTRAINT IF EXISTS seller_inventory_qty_positive;
ALTER TABLE public.seller_inventory ADD CONSTRAINT seller_inventory_qty_positive CHECK (quantity >= 0);
