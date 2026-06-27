-- Migration: 061_claim_unassigned_seller_on_stock_assignment
-- Permite que un admin reclame un vendedor demo/sin asignar al asignarle
-- stock por primera vez. Los vendedores ya asignados a otro admin siguen
-- bloqueados.

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
      AND (id = v_admin_id OR (role = 'vendedor' AND (assigned_admin_id = v_admin_id OR assigned_admin_id IS NULL)))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'El vendedor pertenece a otro administrador');
  END IF;

  UPDATE public.users
  SET assigned_admin_id = v_admin_id
  WHERE id = p_seller_id
    AND role = 'vendedor'
    AND assigned_admin_id IS NULL;

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
      AND (id = v_admin_id OR (role = 'vendedor' AND (assigned_admin_id = v_admin_id OR assigned_admin_id IS NULL)))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'El vendedor pertenece a otro administrador');
  END IF;

  UPDATE public.users
  SET assigned_admin_id = v_admin_id
  WHERE id = p_seller_id
    AND role = 'vendedor'
    AND assigned_admin_id IS NULL;

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
