-- Migration: 053_backfill_legacy_admin_ids
-- Asigna sellers legacy al primer admin encontrado
-- y backfillea admin_id en seller_sales

-- 1. Asignar todos los vendedores sin assigned_admin_id al admin más antiguo
DO $$
DECLARE
  v_first_admin_id UUID;
BEGIN
  SELECT id INTO v_first_admin_id
  FROM public.users
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_first_admin_id IS NOT NULL THEN
    UPDATE public.users
    SET assigned_admin_id = v_first_admin_id
    WHERE role = 'vendedor' AND assigned_admin_id IS NULL;
  END IF;
END;
$$;

-- 2. Backfillear admin_id en seller_sales según el assigned_admin_id del seller
UPDATE public.seller_sales ss
SET admin_id = u.assigned_admin_id
FROM public.users u
WHERE ss.seller_id = u.id
  AND ss.admin_id IS NULL
  AND u.assigned_admin_id IS NOT NULL;

-- 3. Para ventas cuyo seller sigue sin admin asignado (ej. admin vendiendo como seller),
--    asignar el admin_id = seller_id (se atribuyen a sí mismos)
UPDATE public.seller_sales
SET admin_id = seller_id
WHERE admin_id IS NULL;
