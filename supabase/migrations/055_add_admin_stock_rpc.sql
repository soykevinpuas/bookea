-- Migration: 055_add_admin_stock_rpc
-- RPC para que el admin agregue stock a su propio admin_stock

CREATE OR REPLACE FUNCTION public.add_admin_stock(
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
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  IF p_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Cantidad inválida');
  END IF;

  INSERT INTO public.admin_stock (admin_id, book_id, quantity)
  VALUES (v_admin_id, p_book_id, p_quantity)
  ON CONFLICT (admin_id, book_id)
  DO UPDATE SET quantity = admin_stock.quantity + p_quantity, updated_at = NOW();

  RETURN json_build_object('success', true, 'added', p_quantity);
END;
$$;
