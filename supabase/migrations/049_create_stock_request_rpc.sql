-- Migration: 049_create_stock_request_rpc
-- Crea un RPC SECURITY DEFINER para que sellers creen stock requests
-- sin necesitar INSERT policies ni service_role key desde el servidor

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
BEGIN
  -- Validar que el usuario autenticado es el seller o admin
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autenticado');
  END IF;

  IF auth.uid() != p_seller_id THEN
    SELECT role INTO v_book FROM public.users WHERE id = auth.uid();
    IF v_book.role != 'admin' THEN
      RETURN json_build_object('success', false, 'error', 'No autorizado');
    END IF;
  END IF;

  -- Validar items
  IF jsonb_array_length(p_items) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Debes incluir al menos un libro');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'quantity')::INT <= 0 THEN
      RETURN json_build_object('success', false, 'error', 'La cantidad debe ser mayor a 0');
    END IF;

    SELECT stock_physical, title INTO v_book
    FROM public.books
    WHERE id = (v_item->>'book_id')::UUID;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Libro no encontrado: ' || COALESCE(v_item->>'book_id', 'unknown'));
    END IF;

    IF v_book.stock_physical < (v_item->>'quantity')::INT THEN
      RETURN json_build_object('success', false, 'error', 'Stock insuficiente para "' || v_book.title || '". Disponible: ' || v_book.stock_physical);
    END IF;
  END LOOP;

  -- Crear la solicitud
  INSERT INTO public.stock_requests (seller_id, notes, status)
  VALUES (p_seller_id, NULLIF(p_notes, ''), 'pending')
  RETURNING id INTO v_request_id;

  -- Insertar items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.stock_request_items (request_id, book_id, quantity)
    VALUES (v_request_id, (v_item->>'book_id')::UUID, (v_item->>'quantity')::INT);
  END LOOP;

  RETURN json_build_object('success', true, 'request_id', v_request_id);
END;
$$;
