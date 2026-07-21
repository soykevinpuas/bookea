-- Propaga el ID de ventas borradas sin conservar una FK invalida y publica
-- dominios que deben refrescarse mientras la app permanece abierta.

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

  SELECT seller_id, book_id, quantity, sale_price, admin_id INTO v_sale
  FROM public.seller_sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venta no encontrada');
  END IF;

  IF v_sale.book_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Esta venta no tiene libro asociado y no se puede restaurar stock automaticamente'
    );
  END IF;

  SELECT COALESCE(v_sale.admin_id, CASE WHEN u.role = 'admin' THEN u.id ELSE u.assigned_admin_id END)
  INTO v_sale_admin_id
  FROM public.users u
  WHERE u.id = v_sale.seller_id;

  IF v_sale_admin_id IS DISTINCT FROM v_admin_id THEN
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

  v_snapshot := public.build_stock_snapshot(v_admin_id, v_sale.seller_id, v_sale.book_id)
    || jsonb_build_object(
      'deleted_sale_id', p_sale_id,
      'deleted_sale_total', v_sale.quantity * v_sale.sale_price
    );

  v_event_id := public.record_stock_event(
    auth.uid(), v_admin_id, v_sale.seller_id, v_sale.book_id,
    'delete_sale_restore', 0, v_sale.quantity,
    NULL::UUID, NULL::UUID, v_snapshot
  );

  RETURN json_build_object(
    'success', true,
    'restored', v_sale.quantity,
    'deleted_sale_id', p_sale_id,
    'deleted_sale_total', v_sale.quantity * v_sale.sale_price,
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

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'orders_physical', 'user_books', 'coins', 'coin_transactions', 'coin_redemptions', 'referrals'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
END $$;
