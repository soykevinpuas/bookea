-- Migration: 052_fix_admin_metrics_include_self
-- get_admin_metrics incluye ventas del admin como vendedor directo

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
  WHERE (u.assigned_admin_id = p_admin_id OR si.seller_id = p_admin_id);

  RETURN json_build_object(
    'total_vendedores', v_total_vendedores,
    'total_ventas', v_total_ventas,
    'ingresos', v_ingresos,
    'inventario_total', v_inventario_total
  );
END;
$$;
