-- Migration: 060_harden_stock_admin_ownership
-- Refuerza que un admin solo pueda mover stock/ventas de vendedores
-- asignados a ese admin. Se permite admin-as-vendedor cuando p_seller_id
-- es el propio admin.

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_seller_id
      AND (id = v_admin_id OR (role = 'vendedor' AND assigned_admin_id = v_admin_id))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'El vendedor no pertenece a este administrador');
  END IF;

  IF p_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Cantidad inválida');
  END IF;

  SELECT quantity INTO v_admin_qty
  FROM public.admin_stock
  WHERE admin_id = v_admin_id AND book_id = p_book_id
  FOR UPDATE;

  IF v_admin_qty IS NULL OR v_admin_qty < p_quantity THEN
    RETURN json_build_object('success', false, 'error', 'Stock insuficiente. Disponible: ' || COALESCE(v_admin_qty::TEXT, '0'));
  END IF;

  UPDATE public.admin_stock
  SET quantity = quantity - p_quantity, updated_at = NOW()
  WHERE admin_id = v_admin_id AND book_id = p_book_id;

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_seller_id
      AND (id = v_admin_id OR (role = 'vendedor' AND assigned_admin_id = v_admin_id))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'El vendedor no pertenece a este administrador');
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

    SELECT quantity INTO v_admin_qty
    FROM public.admin_stock
    WHERE admin_id = v_admin_id AND book_id = v_book_id
    FOR UPDATE;

    IF v_admin_qty IS NULL OR v_admin_qty < v_quantity THEN
      RETURN json_build_object('success', false, 'error', 'Stock insuficiente para book_id: ' || v_book_id);
    END IF;

    UPDATE public.admin_stock
    SET quantity = quantity - v_quantity, updated_at = NOW()
    WHERE admin_id = v_admin_id AND book_id = v_book_id;

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_seller_id
      AND (id = v_admin_id OR (role = 'vendedor' AND assigned_admin_id = v_admin_id))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'El vendedor no pertenece a este administrador');
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

  IF v_current_qty < p_quantity THEN
    RETURN json_build_object('success', false, 'error', 'El vendedor no tiene suficiente stock asignado');
  END IF;

  v_new_qty := v_current_qty - p_quantity;

  IF v_new_qty <= 0 THEN
    DELETE FROM public.seller_inventory WHERE id = v_inventory_id;
  ELSE
    UPDATE public.seller_inventory
    SET quantity = v_new_qty, updated_at = NOW()
    WHERE id = v_inventory_id;
  END IF;

  INSERT INTO public.admin_stock (admin_id, book_id, quantity)
  VALUES (v_admin_id, p_book_id, p_quantity)
  ON CONFLICT (admin_id, book_id)
  DO UPDATE SET quantity = admin_stock.quantity + p_quantity, updated_at = NOW();

  RETURN json_build_object('success', true, 'removed', p_quantity);
END;
$$;

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_seller_id
      AND (id = v_admin_id OR (role = 'vendedor' AND assigned_admin_id = v_admin_id))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'El vendedor no pertenece a este administrador');
  END IF;

  SELECT id, quantity INTO v_inventory_id, v_current_qty
  FROM public.seller_inventory
  WHERE seller_id = p_seller_id AND book_id = p_book_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', true, 'removed', 0);
  END IF;

  DELETE FROM public.seller_inventory WHERE id = v_inventory_id;

  INSERT INTO public.admin_stock (admin_id, book_id, quantity)
  VALUES (v_admin_id, p_book_id, v_current_qty)
  ON CONFLICT (admin_id, book_id)
  DO UPDATE SET quantity = admin_stock.quantity + v_current_qty, updated_at = NOW();

  RETURN json_build_object('success', true, 'removed', v_current_qty);
END;
$$;

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
  v_sale_admin_id UUID;
  v_inventory_id UUID;
  v_current_qty INT;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT seller_id, book_id, quantity, admin_id INTO v_sale
  FROM public.seller_sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venta no encontrada');
  END IF;

  SELECT COALESCE(v_sale.admin_id, u.assigned_admin_id, v_sale.seller_id)
  INTO v_sale_admin_id
  FROM public.users u
  WHERE u.id = v_sale.seller_id;

  IF v_sale_admin_id != v_admin_id THEN
    RETURN json_build_object('success', false, 'error', 'No puedes eliminar ventas de otro administrador');
  END IF;

  DELETE FROM public.seller_sales WHERE id = p_sale_id;

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
  v_actor_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autenticado');
  END IF;

  SELECT assigned_admin_id INTO v_admin_id
  FROM public.users
  WHERE id = p_seller_id AND role = 'vendedor';

  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'El vendedor no tiene un administrador asignado');
  END IF;

  IF auth.uid() != p_seller_id THEN
    SELECT role INTO v_actor_role FROM public.users WHERE id = auth.uid();
    IF v_actor_role != 'admin' OR auth.uid() != v_admin_id THEN
      RETURN json_build_object('success', false, 'error', 'No autorizado para crear solicitudes de este vendedor');
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
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

CREATE OR REPLACE FUNCTION public.adjust_admin_stock(
  p_book_id UUID,
  p_delta INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID;
  v_current_qty INT;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  IF p_book_id IS NULL OR p_delta IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Parámetros inválidos');
  END IF;

  IF p_delta = 0 THEN
    RETURN json_build_object('success', true, 'adjusted', 0);
  END IF;

  IF p_delta > 0 THEN
    INSERT INTO public.admin_stock (admin_id, book_id, quantity)
    VALUES (v_admin_id, p_book_id, p_delta)
    ON CONFLICT (admin_id, book_id)
    DO UPDATE SET quantity = admin_stock.quantity + p_delta, updated_at = NOW();

    RETURN json_build_object('success', true, 'adjusted', p_delta);
  END IF;

  SELECT quantity INTO v_current_qty
  FROM public.admin_stock
  WHERE admin_id = v_admin_id AND book_id = p_book_id
  FOR UPDATE;

  IF v_current_qty IS NULL OR v_current_qty < ABS(p_delta) THEN
    RETURN json_build_object('success', false, 'error', 'No puedes dejar tu stock por debajo de cero');
  END IF;

  UPDATE public.admin_stock
  SET quantity = quantity + p_delta, updated_at = NOW()
  WHERE admin_id = v_admin_id AND book_id = p_book_id;

  RETURN json_build_object('success', true, 'adjusted', p_delta);
END;
$$;
