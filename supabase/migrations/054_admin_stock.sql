-- Migration: 054_admin_stock
-- Cada admin tiene su propio stock por libro, independiente de otros admins
-- books.stock_physical se mantiene como suma total via trigger

-- 1. Tabla admin_stock
CREATE TABLE public.admin_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(admin_id, book_id)
);

CREATE INDEX idx_admin_stock_admin ON public.admin_stock(admin_id);
CREATE INDEX idx_admin_stock_book ON public.admin_stock(book_id);

ALTER TABLE public.admin_stock ENABLE ROW LEVEL SECURITY;

-- Admin ve solo su propio stock
CREATE POLICY "Admin view own stock" ON public.admin_stock
  FOR SELECT USING (auth.uid() = admin_id);

-- Admin gestiona su propio stock
CREATE POLICY "Admin manage own stock" ON public.admin_stock
  FOR ALL USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

-- 2. Backfill: cada admin existente recibe el stock_physical actual de cada libro
INSERT INTO public.admin_stock (admin_id, book_id, quantity)
SELECT u.id, b.id, b.stock_physical
FROM public.users u, public.books b
WHERE u.role = 'admin' AND b.stock_physical > 0
ON CONFLICT (admin_id, book_id) DO NOTHING;

-- 3. Trigger: mantener books.stock_physical sincronizado con la suma de admin_stock
CREATE OR REPLACE FUNCTION public.sync_admin_stock_sum()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_book_id UUID;
BEGIN
  v_book_id := COALESCE(NEW.book_id, OLD.book_id);

  UPDATE public.books
  SET stock_physical = (
    SELECT COALESCE(SUM(quantity), 0)
    FROM public.admin_stock
    WHERE book_id = v_book_id
  )
  WHERE id = v_book_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_admin_stock_sum
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_stock
  FOR EACH ROW EXECUTE FUNCTION public.sync_admin_stock_sum();

-- 4. Actualizar assign_stock: resta de admin_stock del admin caller en vez de books.stock_physical
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
  v_admin_id UUID;
  v_admin_qty INT;
  v_inventory_id UUID;
  v_current_qty INT;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  IF p_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Cantidad inválida');
  END IF;

  -- Verificar stock del admin
  SELECT quantity INTO v_admin_qty
  FROM public.admin_stock
  WHERE admin_id = v_admin_id AND book_id = p_book_id
  FOR UPDATE;

  IF v_admin_qty IS NULL OR v_admin_qty < p_quantity THEN
    RETURN json_build_object('success', false, 'error', 'Stock insuficiente. Disponible: ' || COALESCE(v_admin_qty::TEXT, '0'));
  END IF;

  -- Restar de admin_stock
  UPDATE public.admin_stock
  SET quantity = quantity - p_quantity, updated_at = NOW()
  WHERE admin_id = v_admin_id AND book_id = p_book_id;

  -- Sumar a seller_inventory
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

  RETURN json_build_object('success', true, 'assigned', p_quantity);
END;
$$;

-- 5. Actualizar assign_stock_batch: igual que assign_stock pero batch
CREATE OR REPLACE FUNCTION public.assign_stock_batch(
  p_seller_id UUID,
  p_items JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID;
  v_item JSONB;
  v_book_id UUID;
  v_quantity INT;
  v_admin_qty INT;
  v_inventory_id UUID;
  v_current_qty INT;
  v_assigned INT := 0;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
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

    -- Verificar stock del admin
    SELECT quantity INTO v_admin_qty
    FROM public.admin_stock
    WHERE admin_id = v_admin_id AND book_id = v_book_id
    FOR UPDATE;

    IF v_admin_qty IS NULL OR v_admin_qty < v_quantity THEN
      RETURN json_build_object('success', false, 'error', 'Stock insuficiente para book_id: ' || v_book_id);
    END IF;

    -- Restar de admin_stock
    UPDATE public.admin_stock
    SET quantity = quantity - v_quantity, updated_at = NOW()
    WHERE admin_id = v_admin_id AND book_id = v_book_id;

    -- Sumar a seller_inventory
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

    v_assigned := v_assigned + v_quantity;
  END LOOP;

  RETURN json_build_object('success', true, 'assigned', v_assigned);
END;
$$;

-- 6. Actualizar deliver_stock_request: resta de admin_stock del admin que entrega
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

  FOR v_item IN SELECT * FROM public.stock_request_items WHERE request_id = p_request_id
  LOOP
    UPDATE public.stock_request_items
    SET received_at = NOW()
    WHERE id = v_item.id AND received_at IS NULL;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Verificar y restar de admin_stock del admin que entrega
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

-- 7. Actualizar revert_assign_stock: devuelve a admin_stock del admin caller
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
  v_admin_id UUID;
  v_current_qty INT;
  v_inventory_id UUID;
  v_new_qty INT;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
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

  -- Devolver a admin_stock del admin caller
  INSERT INTO public.admin_stock (admin_id, book_id, quantity)
  VALUES (v_admin_id, p_book_id, p_quantity)
  ON CONFLICT (admin_id, book_id)
  DO UPDATE SET quantity = admin_stock.quantity + p_quantity, updated_at = NOW();

  RETURN json_build_object('success', true, 'removed', p_quantity);
END;
$$;

-- 8. Actualizar remove_seller_stock: devuelve a admin_stock del admin caller
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
  v_admin_id UUID;
  v_current_qty INT;
  v_inventory_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
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

  -- Devolver a admin_stock del admin caller
  INSERT INTO public.admin_stock (admin_id, book_id, quantity)
  VALUES (v_admin_id, p_book_id, v_current_qty)
  ON CONFLICT (admin_id, book_id)
  DO UPDATE SET quantity = admin_stock.quantity + v_current_qty, updated_at = NOW();

  RETURN json_build_object('success', true, 'removed', v_current_qty);
END;
$$;

-- 9. Actualizar create_stock_request: verifica stock del admin del seller
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

  -- Obtener el admin del seller
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

    -- Verificar stock en el admin_stock del admin del seller
    SELECT quantity INTO v_admin_qty
    FROM public.admin_stock
    WHERE admin_id = v_admin_id AND book_id = (v_item->>'book_id')::UUID;

    IF v_admin_qty IS NULL OR v_admin_qty < (v_item->>'quantity')::INT THEN
      RETURN json_build_object('success', false, 'error', 'Stock insuficiente de "' || v_book.title || '" en el inventario de tu administrador. Disponible: ' || COALESCE(v_admin_qty::TEXT, '0'));
    END IF;
  END LOOP;

  INSERT INTO public.stock_requests (seller_id, notes, status)
  VALUES (p_seller_id, NULLIF(p_notes, ''), 'pending')
  RETURNING id INTO v_request_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.stock_request_items (request_id, book_id, quantity)
    VALUES (v_request_id, (v_item->>'book_id')::UUID, (v_item->>'quantity')::INT);
  END LOOP;

  RETURN json_build_object('success', true, 'request_id', v_request_id);
END;
$$;

-- 10. Actualizar delete_sale_and_restore_stock: también devuelve stock al admin
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
  v_admin_id UUID;
  v_inventory_id UUID;
  v_current_qty INT;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT seller_id, book_id, quantity INTO v_sale
  FROM public.seller_sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venta no encontrada');
  END IF;

  DELETE FROM public.seller_sales WHERE id = p_sale_id;

  -- Restaurar a seller_inventory
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
