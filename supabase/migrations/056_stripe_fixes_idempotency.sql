-- Migration: 056_stripe_fixes_idempotency
-- 1. Idempotency table for Stripe webhook events
-- 2. RPC to decrement from admin_stock (replaces decrement_stock for webhook)

-- 1. Idempotency table
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RPC: decrement from any admin's stock (for customer purchases via webhook)
-- Finds the admin with the most stock for the given book and decrements
CREATE OR REPLACE FUNCTION public.decrement_admin_stock(
  p_book_id UUID,
  p_quantity INT DEFAULT 1
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
  IF p_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Cantidad inválida');
  END IF;

  -- Find admin with most stock for this book
  SELECT admin_id, quantity INTO v_admin_id, v_current_qty
  FROM public.admin_stock
  WHERE book_id = p_book_id AND quantity > 0
  ORDER BY quantity DESC
  LIMIT 1
  FOR UPDATE;

  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Stock insuficiente');
  END IF;

  IF v_current_qty < p_quantity THEN
    RETURN json_build_object('success', false, 'error', 'Stock insuficiente. Disponible: ' || v_current_qty::TEXT);
  END IF;

  UPDATE public.admin_stock
  SET quantity = quantity - p_quantity, updated_at = NOW()
  WHERE admin_id = v_admin_id AND book_id = p_book_id;

  RETURN json_build_object('success', true, 'admin_id', v_admin_id, 'decremented', p_quantity);
END;
$$;
