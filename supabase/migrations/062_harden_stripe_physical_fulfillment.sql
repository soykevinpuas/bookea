-- Migration: 062_harden_stripe_physical_fulfillment
-- Harden Stripe physical fulfillment by making order creation and stock
-- decrement happen inside one database transaction.

ALTER TABLE public.orders_physical
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0);

ALTER TABLE public.orders_physical
  ADD COLUMN IF NOT EXISTS stock_decremented_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.fulfill_physical_order_from_stripe(
  p_user_id UUID,
  p_book_id UUID,
  p_stripe_payment_id TEXT,
  p_quantity INTEGER,
  p_name TEXT,
  p_address TEXT,
  p_city TEXT,
  p_state TEXT,
  p_zip TEXT,
  p_phone TEXT,
  p_shipping_cost NUMERIC,
  p_total NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id UUID;
  v_stock_decremented_at TIMESTAMPTZ;
  v_decrement_result JSON;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'No autorizado para cumplir orden fisica desde Stripe';
  END IF;

  IF p_user_id IS NULL OR p_book_id IS NULL THEN
    RAISE EXCEPTION 'Usuario y libro son requeridos para cumplir una orden fisica';
  END IF;

  IF p_stripe_payment_id IS NULL OR length(trim(p_stripe_payment_id)) = 0 THEN
    RAISE EXCEPTION 'stripe_payment_id es requerido para cumplir una orden fisica';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Cantidad invalida para orden fisica: %', p_quantity;
  END IF;

  IF p_total IS NULL OR p_total < 0 THEN
    RAISE EXCEPTION 'Total invalido para orden fisica: %', p_total;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_stripe_payment_id || ':' || p_book_id::TEXT, 0)
  );

  SELECT id, stock_decremented_at
    INTO v_order_id, v_stock_decremented_at
  FROM public.orders_physical
  WHERE stripe_payment_id = p_stripe_payment_id
    AND book_id = p_book_id
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_order_id IS NULL THEN
    INSERT INTO public.orders_physical (
      user_id,
      book_id,
      status,
      name,
      address,
      city,
      state,
      zip,
      phone,
      shipping_cost,
      total,
      stripe_payment_id,
      quantity
    )
    VALUES (
      p_user_id,
      p_book_id,
      'pending',
      COALESCE(p_name, ''),
      COALESCE(p_address, ''),
      COALESCE(p_city, ''),
      COALESCE(p_state, ''),
      COALESCE(p_zip, ''),
      COALESCE(p_phone, ''),
      COALESCE(p_shipping_cost, 0),
      p_total,
      p_stripe_payment_id,
      p_quantity
    )
    RETURNING id, stock_decremented_at INTO v_order_id, v_stock_decremented_at;
  ELSIF v_stock_decremented_at IS NULL THEN
    UPDATE public.orders_physical
    SET
      name = COALESCE(p_name, name),
      address = COALESCE(p_address, address),
      city = COALESCE(p_city, city),
      state = COALESCE(p_state, state),
      zip = COALESCE(p_zip, zip),
      phone = COALESCE(p_phone, phone),
      shipping_cost = COALESCE(p_shipping_cost, shipping_cost),
      total = p_total,
      quantity = p_quantity
    WHERE id = v_order_id;
  END IF;

  IF v_stock_decremented_at IS NULL THEN
    v_decrement_result := public.decrement_admin_stock(p_book_id, p_quantity);

    IF NOT COALESCE((v_decrement_result->>'success')::BOOLEAN, FALSE) THEN
      RAISE EXCEPTION 'No se pudo descontar stock fisico: %',
        COALESCE(v_decrement_result->>'error', 'error desconocido');
    END IF;

    UPDATE public.orders_physical
    SET stock_decremented_at = NOW()
    WHERE id = v_order_id;
  END IF;

  RETURN json_build_object(
    'success', TRUE,
    'order_id', v_order_id,
    'already_processed', v_stock_decremented_at IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_admin_stock(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_admin_stock(UUID, INT) TO service_role;

REVOKE ALL ON FUNCTION public.fulfill_physical_order_from_stripe(
  UUID,
  UUID,
  TEXT,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  NUMERIC
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fulfill_physical_order_from_stripe(
  UUID,
  UUID,
  TEXT,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  NUMERIC
) TO service_role;
