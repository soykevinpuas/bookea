-- Migration: 065_stock_events_snapshots
-- Agrega eventos/snapshots de stock para que la UI actualice inventario
-- desde la respuesta transaccional, dejando Realtime como reconciliacion.

CREATE TABLE IF NOT EXISTS public.stock_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (
    action IN (
      'assign',
      'assign_batch',
      'sell',
      'revert_assign',
      'remove_seller_stock',
      'delete_sale_restore',
      'adjust_admin_stock'
    )
  ),
  delta_warehouse INTEGER NOT NULL DEFAULT 0,
  delta_seller INTEGER NOT NULL DEFAULT 0,
  sale_id UUID REFERENCES public.seller_sales(id) ON DELETE SET NULL,
  request_id UUID REFERENCES public.stock_requests(id) ON DELETE SET NULL,
  snapshot_after JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_events_admin_created
  ON public.stock_events(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_events_seller_created
  ON public.stock_events(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_events_book_created
  ON public.stock_events(book_id, created_at DESC);

ALTER TABLE public.stock_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view own stock events" ON public.stock_events;
DROP POLICY IF EXISTS "Sellers view own stock events" ON public.stock_events;

CREATE POLICY "Admins view own stock events" ON public.stock_events
  FOR SELECT USING (auth.uid() = admin_id);

CREATE POLICY "Sellers view own stock events" ON public.stock_events
  FOR SELECT USING (auth.uid() = seller_id);

GRANT SELECT ON public.stock_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.stock_events FROM authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'stock_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_events;
  END IF;
END $$;

ALTER TABLE public.stock_events REPLICA IDENTITY FULL;

-- Snapshot canonico por libro/admin/vendedor. El frontend aplica este payload
-- en todas las caches para evitar refetches que reintroduzcan estado viejo.
CREATE OR REPLACE FUNCTION public.build_stock_snapshot(
  p_admin_id UUID,
  p_seller_id UUID,
  p_book_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_warehouse_qty INT := 0;
  v_assigned_qty INT := 0;
  v_seller_qty INT := 0;
  v_seller_total_qty INT := 0;
  v_seller_inventory_count INT := 0;
  v_book JSONB := NULL;
  v_seller_email TEXT := NULL;
  v_version TEXT;
BEGIN
  IF p_admin_id IS NOT NULL THEN
    SELECT COALESCE(quantity, 0)
    INTO v_warehouse_qty
    FROM public.admin_stock
    WHERE admin_id = p_admin_id AND book_id = p_book_id;

    v_warehouse_qty := COALESCE(v_warehouse_qty, 0);

    SELECT COALESCE(SUM(si.quantity), 0)
    INTO v_assigned_qty
    FROM public.seller_inventory si
    JOIN public.users u ON u.id = si.seller_id
    WHERE si.book_id = p_book_id
      AND (
        si.seller_id = p_admin_id
        OR (u.role = 'vendedor' AND u.assigned_admin_id = p_admin_id)
      );
  END IF;

  IF p_seller_id IS NOT NULL THEN
    SELECT COALESCE(quantity, 0)
    INTO v_seller_qty
    FROM public.seller_inventory
    WHERE seller_id = p_seller_id AND book_id = p_book_id;

    SELECT
      COALESCE(SUM(quantity), 0),
      COUNT(*) FILTER (WHERE quantity > 0)
    INTO v_seller_total_qty, v_seller_inventory_count
    FROM public.seller_inventory
    WHERE seller_id = p_seller_id;

    SELECT email INTO v_seller_email
    FROM public.users
    WHERE id = p_seller_id;
  END IF;

  SELECT jsonb_build_object(
    'id', b.id,
    'title', b.title,
    'author', b.author,
    'cover_url', b.cover_url,
    'price_physical', b.price_physical
  )
  INTO v_book
  FROM public.books b
  WHERE b.id = p_book_id;

  v_version := to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  RETURN jsonb_build_object(
    'admin_id', p_admin_id,
    'seller_id', p_seller_id,
    'seller_email', v_seller_email,
    'book_id', p_book_id,
    'book', v_book,
    'warehouse_quantity', COALESCE(v_warehouse_qty, 0),
    'assigned_quantity', COALESCE(v_assigned_qty, 0),
    'seller_quantity', COALESCE(v_seller_qty, 0),
    'seller_total_quantity', COALESCE(v_seller_total_qty, 0),
    'seller_inventory_count', COALESCE(v_seller_inventory_count, 0),
    'total_physical', COALESCE(v_warehouse_qty, 0) + COALESCE(v_assigned_qty, 0),
    'updated_at', v_version,
    'version', v_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_stock_event(
  p_actor_id UUID,
  p_admin_id UUID,
  p_seller_id UUID,
  p_book_id UUID,
  p_action TEXT,
  p_delta_warehouse INT,
  p_delta_seller INT,
  p_sale_id UUID,
  p_request_id UUID,
  p_snapshot_after JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.stock_events (
    actor_id,
    admin_id,
    seller_id,
    book_id,
    action,
    delta_warehouse,
    delta_seller,
    sale_id,
    request_id,
    snapshot_after
  )
  VALUES (
    p_actor_id,
    p_admin_id,
    p_seller_id,
    p_book_id,
    p_action,
    COALESCE(p_delta_warehouse, 0),
    COALESCE(p_delta_seller, 0),
    p_sale_id,
    p_request_id,
    p_snapshot_after
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.build_stock_snapshot(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_stock_event(UUID, UUID, UUID, UUID, TEXT, INT, INT, UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;

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
  v_snapshot JSONB;
  v_event_id UUID;
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

  v_snapshot := public.build_stock_snapshot(v_admin_id, p_seller_id, p_book_id);
  v_event_id := public.record_stock_event(
    auth.uid(),
    v_admin_id,
    p_seller_id,
    p_book_id,
    'assign',
    -p_quantity,
    p_quantity,
    NULL,
    NULL,
    v_snapshot
  );

  RETURN json_build_object(
    'success', true,
    'assigned', p_quantity,
    'mutation_id', v_event_id,
    'snapshots', jsonb_build_array(v_snapshot),
    'events', jsonb_build_array(jsonb_build_object(
      'id', v_event_id,
      'action', 'assign',
      'snapshot_after', v_snapshot
    ))
  );
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
  v_book_id UUID;
  v_quantity INT;
  v_admin_qty INT;
  v_inventory_id UUID;
  v_current_qty INT;
  v_assigned INT := 0;
  v_snapshot JSONB;
  v_snapshots JSONB := '[]'::JSONB;
  v_events JSONB := '[]'::JSONB;
  v_event_id UUID;
  v_mutation_id UUID := NULL;
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

  FOR v_book_id, v_quantity IN
    SELECT (item->>'book_id')::UUID, SUM((item->>'quantity')::INT)::INT
    FROM jsonb_array_elements(p_items) item
    GROUP BY 1
  LOOP
    IF v_quantity <= 0 THEN
      RETURN json_build_object('success', false, 'error', 'Cantidad inválida para book_id: ' || v_book_id);
    END IF;

    SELECT quantity INTO v_admin_qty
    FROM public.admin_stock
    WHERE admin_id = v_admin_id AND book_id = v_book_id
    FOR UPDATE;

    IF v_admin_qty IS NULL OR v_admin_qty < v_quantity THEN
      RETURN json_build_object('success', false, 'error', 'Stock insuficiente para book_id: ' || v_book_id || '. Disponible: ' || COALESCE(v_admin_qty::TEXT, '0'));
    END IF;
  END LOOP;

  FOR v_book_id, v_quantity IN
    SELECT (item->>'book_id')::UUID, SUM((item->>'quantity')::INT)::INT
    FROM jsonb_array_elements(p_items) item
    GROUP BY 1
  LOOP
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

    v_snapshot := public.build_stock_snapshot(v_admin_id, p_seller_id, v_book_id);
    v_event_id := public.record_stock_event(
      auth.uid(),
      v_admin_id,
      p_seller_id,
      v_book_id,
      'assign_batch',
      -v_quantity,
      v_quantity,
      NULL,
      NULL,
      v_snapshot
    );

    IF v_mutation_id IS NULL THEN
      v_mutation_id := v_event_id;
    END IF;

    v_snapshots := v_snapshots || jsonb_build_array(v_snapshot);
    v_events := v_events || jsonb_build_array(jsonb_build_object(
      'id', v_event_id,
      'action', 'assign_batch',
      'snapshot_after', v_snapshot
    ));
    v_assigned := v_assigned + v_quantity;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'assigned', v_assigned,
    'mutation_id', v_mutation_id,
    'snapshots', v_snapshots,
    'events', v_events
  );
END;
$$;

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
  v_new_qty INT;
  v_admin_id UUID;
  v_seller_role TEXT;
  v_sale RECORD;
  v_snapshot JSONB;
  v_event_id UUID;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Cantidad invalida');
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

  SELECT role, CASE WHEN role = 'admin' THEN id ELSE assigned_admin_id END
  INTO v_seller_role, v_admin_id
  FROM public.users
  WHERE id = p_seller_id;

  SELECT id, quantity INTO v_inventory_id, v_current_qty
  FROM public.seller_inventory
  WHERE seller_id = p_seller_id
    AND book_id = p_book_id
    AND quantity > 0
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Libro no encontrado en tu inventario');
  END IF;

  IF v_current_qty < p_quantity THEN
    RETURN json_build_object('success', false, 'error', 'Stock insuficiente');
  END IF;

  INSERT INTO public.seller_sales (seller_id, book_id, quantity, sale_price, admin_id)
  VALUES (p_seller_id, p_book_id, p_quantity, p_sale_price, v_admin_id)
  RETURNING * INTO v_sale;

  v_new_qty := v_current_qty - p_quantity;

  IF v_new_qty <= 0 THEN
    DELETE FROM public.seller_inventory
    WHERE id = v_inventory_id;
  ELSE
    UPDATE public.seller_inventory
    SET quantity = v_new_qty, updated_at = NOW()
    WHERE id = v_inventory_id;
  END IF;

  v_snapshot := public.build_stock_snapshot(v_admin_id, p_seller_id, p_book_id);
  v_event_id := public.record_stock_event(
    auth.uid(),
    v_admin_id,
    p_seller_id,
    p_book_id,
    'sell',
    0,
    -p_quantity,
    v_sale.id,
    NULL,
    v_snapshot
  );

  RETURN json_build_object(
    'success', true,
    'mutation_id', v_event_id,
    'snapshots', jsonb_build_array(v_snapshot),
    'events', jsonb_build_array(jsonb_build_object(
      'id', v_event_id,
      'action', 'sell',
      'snapshot_after', v_snapshot
    )),
    'sale', jsonb_build_object(
      'id', v_sale.id,
      'seller_id', v_sale.seller_id,
      'book_id', v_sale.book_id,
      'quantity', v_sale.quantity,
      'sale_price', v_sale.sale_price,
      'sold_at', v_sale.sold_at,
      'paid_at', v_sale.paid_at,
      'admin_id', v_sale.admin_id,
      'books', v_snapshot->'book'
    )
  );
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
  v_snapshot JSONB;
  v_event_id UUID;
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

  v_snapshot := public.build_stock_snapshot(v_admin_id, p_seller_id, p_book_id);
  v_event_id := public.record_stock_event(
    auth.uid(),
    v_admin_id,
    p_seller_id,
    p_book_id,
    'revert_assign',
    p_quantity,
    -p_quantity,
    NULL,
    NULL,
    v_snapshot
  );

  RETURN json_build_object(
    'success', true,
    'removed', p_quantity,
    'mutation_id', v_event_id,
    'snapshots', jsonb_build_array(v_snapshot),
    'events', jsonb_build_array(jsonb_build_object(
      'id', v_event_id,
      'action', 'revert_assign',
      'snapshot_after', v_snapshot
    ))
  );
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
  v_snapshot JSONB;
  v_event_id UUID;
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
    v_snapshot := public.build_stock_snapshot(v_admin_id, p_seller_id, p_book_id);
    RETURN json_build_object(
      'success', true,
      'removed', 0,
      'snapshots', jsonb_build_array(v_snapshot)
    );
  END IF;

  DELETE FROM public.seller_inventory WHERE id = v_inventory_id;

  INSERT INTO public.admin_stock (admin_id, book_id, quantity)
  VALUES (v_admin_id, p_book_id, v_current_qty)
  ON CONFLICT (admin_id, book_id)
  DO UPDATE SET quantity = admin_stock.quantity + v_current_qty, updated_at = NOW();

  v_snapshot := public.build_stock_snapshot(v_admin_id, p_seller_id, p_book_id);
  v_event_id := public.record_stock_event(
    auth.uid(),
    v_admin_id,
    p_seller_id,
    p_book_id,
    'remove_seller_stock',
    v_current_qty,
    -v_current_qty,
    NULL,
    NULL,
    v_snapshot
  );

  RETURN json_build_object(
    'success', true,
    'removed', v_current_qty,
    'mutation_id', v_event_id,
    'snapshots', jsonb_build_array(v_snapshot),
    'events', jsonb_build_array(jsonb_build_object(
      'id', v_event_id,
      'action', 'remove_seller_stock',
      'snapshot_after', v_snapshot
    ))
  );
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
  v_snapshot JSONB;
  v_event_id UUID;
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

  SELECT COALESCE(v_sale.admin_id, CASE WHEN u.role = 'admin' THEN u.id ELSE u.assigned_admin_id END)
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

  v_snapshot := public.build_stock_snapshot(v_admin_id, v_sale.seller_id, v_sale.book_id);
  v_event_id := public.record_stock_event(
    auth.uid(),
    v_admin_id,
    v_sale.seller_id,
    v_sale.book_id,
    'delete_sale_restore',
    0,
    v_sale.quantity,
    p_sale_id,
    NULL,
    v_snapshot
  );

  RETURN json_build_object(
    'success', true,
    'restored', v_sale.quantity,
    'mutation_id', v_event_id,
    'snapshots', jsonb_build_array(v_snapshot),
    'events', jsonb_build_array(jsonb_build_object(
      'id', v_event_id,
      'action', 'delete_sale_restore',
      'snapshot_after', v_snapshot
    ))
  );
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
  v_snapshot JSONB;
  v_event_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  IF p_book_id IS NULL OR p_delta IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Parámetros inválidos');
  END IF;

  IF p_delta = 0 THEN
    v_snapshot := public.build_stock_snapshot(v_admin_id, NULL, p_book_id);
    RETURN json_build_object(
      'success', true,
      'adjusted', 0,
      'snapshots', jsonb_build_array(v_snapshot)
    );
  END IF;

  IF p_delta > 0 THEN
    INSERT INTO public.admin_stock (admin_id, book_id, quantity)
    VALUES (v_admin_id, p_book_id, p_delta)
    ON CONFLICT (admin_id, book_id)
    DO UPDATE SET quantity = admin_stock.quantity + p_delta, updated_at = NOW();
  ELSE
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
  END IF;

  v_snapshot := public.build_stock_snapshot(v_admin_id, NULL, p_book_id);
  v_event_id := public.record_stock_event(
    auth.uid(),
    v_admin_id,
    NULL,
    p_book_id,
    'adjust_admin_stock',
    p_delta,
    0,
    NULL,
    NULL,
    v_snapshot
  );

  RETURN json_build_object(
    'success', true,
    'adjusted', p_delta,
    'mutation_id', v_event_id,
    'snapshots', jsonb_build_array(v_snapshot),
    'events', jsonb_build_array(jsonb_build_object(
      'id', v_event_id,
      'action', 'adjust_admin_stock',
      'snapshot_after', v_snapshot
    ))
  );
END;
$$;
