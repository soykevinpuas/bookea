-- Migration 032: Ensure all users have a profile + auto-create on role promotion

-- 1. Catch any auth.users that somehow missed the public.users trigger
INSERT INTO public.users (id, email, role)
SELECT au.id, au.email, 'free'
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- 2. Create profiles for ALL users who lack one
INSERT INTO public.profiles (user_id, id)
SELECT u.id, u.id
FROM public.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id);

-- 3. Update admin_change_user_role to ensure profile exists on promotion
CREATE OR REPLACE FUNCTION public.admin_change_user_role(target_user_id UUID, new_role TEXT)
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

    IF new_role NOT IN ('free', 'subscriber', 'admin', 'vendedor') THEN
        RETURN json_build_object('success', false, 'error', 'Rol inválido: ' || new_role);
    END IF;

    UPDATE public.users
    SET role = new_role
    WHERE id = target_user_id;

    GET DIAGNOSTICS affected = ROW_COUNT;

    IF affected = 0 THEN
        RETURN json_build_object('success', false, 'error', 'Usuario no encontrado: ' || target_user_id);
    END IF;

    -- Ensure profile exists for the user
    INSERT INTO public.profiles (user_id, id)
    SELECT target_user_id, target_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = target_user_id);

    RETURN json_build_object('success', true, 'affected_rows', affected, 'new_role', new_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
