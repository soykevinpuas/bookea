-- Migration: 050_multi_admin_tracking
-- Cada admin tiene sus propios vendedores, ingresos y métricas

-- 1. Agregar assigned_admin_id a users (solo vendedores tienen admin asignado)
ALTER TABLE public.users
  ADD COLUMN assigned_admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX idx_users_assigned_admin ON public.users(assigned_admin_id);

-- 2. Agregar admin_id a seller_sales para rastrear qué admin recibe el crédito
ALTER TABLE public.seller_sales
  ADD COLUMN admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX idx_seller_sales_admin ON public.seller_sales(admin_id);

-- 3. Actualizar admin_change_user_role para asignar assigned_admin_id
CREATE OR REPLACE FUNCTION public.admin_change_user_role(target_user_id UUID, new_role TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    caller_role TEXT;
    affected INT;
BEGIN
    SELECT role INTO caller_role
    FROM public.users
    WHERE id = auth.uid();

    IF caller_role IS NULL OR caller_role != 'admin' THEN
        RETURN json_build_object('success', false, 'error', 'No tienes permisos de administrador');
    END IF;

    IF new_role NOT IN ('free', 'subscriber', 'admin', 'vendedor') THEN
        RETURN json_build_object('success', false, 'error', 'Rol inválido: ' || new_role);
    END IF;

    UPDATE public.users
    SET role = new_role,
        assigned_admin_id = CASE WHEN new_role = 'vendedor' THEN auth.uid() ELSE assigned_admin_id END
    WHERE id = target_user_id;

    GET DIAGNOSTICS affected = ROW_COUNT;

    IF affected = 0 THEN
        RETURN json_build_object('success', false, 'error', 'Usuario no encontrado: ' || target_user_id);
    END IF;

    RETURN json_build_object('success', true, 'affected_rows', affected, 'new_role', new_role);
END;
$$;

-- 4. Actualizar sell_book para guardar admin_id de la venta
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
  v_admin_id UUID;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Cantidad inválida');
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

  -- Obtener el admin asignado al vendedor
  SELECT assigned_admin_id INTO v_admin_id
  FROM public.users
  WHERE id = p_seller_id;

  -- FOR UPDATE bloquea la fila concurrente y previene el race condition
  SELECT id, quantity INTO v_inventory_id, v_current_qty
  FROM public.seller_inventory
  WHERE seller_id = p_seller_id AND book_id = p_book_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Libro no encontrado en tu inventario');
  END IF;

  IF v_current_qty < p_quantity THEN
    RETURN json_build_object('success', false, 'error', 'Stock insuficiente');
  END IF;

  INSERT INTO public.seller_sales (seller_id, book_id, quantity, sale_price, admin_id)
  VALUES (p_seller_id, p_book_id, p_quantity, p_sale_price, v_admin_id);

  UPDATE public.seller_inventory
  SET quantity = quantity - p_quantity, updated_at = NOW()
  WHERE id = v_inventory_id;

  RETURN json_build_object('success', true);
END;
$$;

-- 5. Vista de métricas por admin (opcional, para queries directas)
CREATE OR REPLACE FUNCTION public.get_admin_metrics(p_admin_id UUID DEFAULT auth.uid())
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_vendedores INT;
  v_total_ventas INT;
  v_ingresos NUMERIC;
  v_inventario_total INT;
BEGIN
  SELECT COUNT(*) INTO v_total_vendedores
  FROM public.users
  WHERE assigned_admin_id = p_admin_id AND role = 'vendedor';

  SELECT COALESCE(SUM(quantity), 0) INTO v_total_ventas
  FROM public.seller_sales
  WHERE admin_id = p_admin_id;

  SELECT COALESCE(SUM(quantity * sale_price), 0) INTO v_ingresos
  FROM public.seller_sales
  WHERE admin_id = p_admin_id;

  SELECT COALESCE(SUM(si.quantity), 0) INTO v_inventario_total
  FROM public.seller_inventory si
  JOIN public.users u ON u.id = si.seller_id
  WHERE u.assigned_admin_id = p_admin_id;

  RETURN json_build_object(
    'total_vendedores', v_total_vendedores,
    'total_ventas', v_total_ventas,
    'ingresos', v_ingresos,
    'inventario_total', v_inventario_total
  );
END;
$$;
