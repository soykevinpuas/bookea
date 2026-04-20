-- Migration: 008_rpc_admin_actions.sql
-- RPC seguro para que admins cambien roles bypasseando RLS
-- SECURITY DEFINER = ejecuta como dueño de la función (bypasea RLS)

-- Primero dropeamos las funciones si existen para recrearlas limpias
DROP FUNCTION IF EXISTS public.admin_change_user_role(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_set_subscription_date(UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.admin_change_user_role(target_user_id UUID, new_role TEXT)
RETURNS JSON AS $$
DECLARE
    caller_role TEXT;
    affected INT;
BEGIN
    -- Verificar que el caller es admin (SECURITY DEFINER bypasea RLS aquí)
    SELECT role INTO caller_role
    FROM public.users 
    WHERE id = auth.uid();

    -- Si auth.uid() es NULL o no es admin, rechazar
    IF caller_role IS NULL OR caller_role != 'admin' THEN
        RETURN json_build_object('success', false, 'error', 'No tienes permisos de administrador');
    END IF;

    -- Validar el nuevo rol
    IF new_role NOT IN ('free', 'subscriber', 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Rol inválido: ' || new_role);
    END IF;

    -- Ejecutar el UPDATE
    UPDATE public.users 
    SET role = new_role
    WHERE id = target_user_id;

    GET DIAGNOSTICS affected = ROW_COUNT;

    IF affected = 0 THEN
        RETURN json_build_object('success', false, 'error', 'Usuario no encontrado: ' || target_user_id);
    END IF;

    RETURN json_build_object('success', true, 'affected_rows', affected, 'new_role', new_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_set_subscription_date(target_user_id UUID, new_ends_at TIMESTAMPTZ)
RETURNS JSON AS $$
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

    UPDATE public.users 
    SET subscription_ends_at = new_ends_at
    WHERE id = target_user_id;

    GET DIAGNOSTICS affected = ROW_COUNT;

    IF affected = 0 THEN
        RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
    END IF;

    RETURN json_build_object('success', true, 'affected_rows', affected);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
