-- Costo privado por admin/título y snapshot inmutable por venta.
CREATE TABLE public.admin_book_costs (
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  acquisition_cost NUMERIC(10, 2) NOT NULL DEFAULT 100 CHECK (acquisition_cost >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (admin_id, book_id)
);

ALTER TABLE public.admin_book_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read own book costs"
  ON public.admin_book_costs FOR SELECT
  USING (admin_id = auth.uid() AND public.is_admin());

-- Las escrituras pasan por la ruta admin autenticada con service role.

ALTER TABLE public.seller_sales
  ADD COLUMN acquisition_cost NUMERIC(10, 2) NOT NULL DEFAULT 100
  CHECK (acquisition_cost >= 0);

COMMENT ON TABLE public.admin_book_costs IS
  'Costo físico vigente y privado de cada admin por título.';
COMMENT ON COLUMN public.seller_sales.acquisition_cost IS
  'Snapshot del costo unitario al registrar la venta; no cambia al editar el libro.';

-- Los snapshots llevan el costo para que el inventario del admin se actualice sin refetch.
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
    'price_physical', b.price_physical,
    'acquisition_cost', COALESCE(abc.acquisition_cost, 100)
  )
  INTO v_book
  FROM public.books b
  LEFT JOIN public.admin_book_costs abc
    ON abc.book_id = b.id AND abc.admin_id = p_admin_id
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
  v_acquisition_cost NUMERIC(10, 2);
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

  SELECT COALESCE(
    (SELECT acquisition_cost
     FROM public.admin_book_costs
     WHERE admin_id = v_admin_id AND book_id = p_book_id),
    100
  )
  INTO v_acquisition_cost;

  IF NOT EXISTS (SELECT 1 FROM public.books WHERE id = p_book_id) THEN
    RETURN json_build_object('success', false, 'error', 'Libro no encontrado');
  END IF;

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

  INSERT INTO public.seller_sales (
    seller_id, book_id, quantity, sale_price, admin_id, acquisition_cost
  )
  VALUES (
    p_seller_id, p_book_id, p_quantity, p_sale_price, v_admin_id, v_acquisition_cost
  )
  RETURNING * INTO v_sale;

  v_new_qty := v_current_qty - p_quantity;

  IF v_new_qty <= 0 THEN
    DELETE FROM public.seller_inventory WHERE id = v_inventory_id;
  ELSE
    UPDATE public.seller_inventory
    SET quantity = v_new_qty, updated_at = NOW()
    WHERE id = v_inventory_id;
  END IF;

  v_snapshot := public.build_stock_snapshot(v_admin_id, p_seller_id, p_book_id);
  v_event_id := public.record_stock_event(
    auth.uid(), v_admin_id, p_seller_id, p_book_id, 'sell',
    0, -p_quantity, v_sale.id, NULL, v_snapshot
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
      'acquisition_cost', v_sale.acquisition_cost,
      'sold_at', v_sale.sold_at,
      'paid_at', v_sale.paid_at,
      'admin_id', v_sale.admin_id,
      'books', v_snapshot->'book'
    )
  );
END;
$$;
