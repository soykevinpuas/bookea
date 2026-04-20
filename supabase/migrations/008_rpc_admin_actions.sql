-- Migration: 008_rpc_change_role.sql
-- Create a secure RPC for admins to change a user's role without falling into RLS infinite recursion bugs

CREATE OR REPLACE FUNCTION public.admin_change_user_role(target_user_id UUID, new_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    -- Verify the caller is an admin
    SELECT (role = 'admin') INTO is_admin 
    FROM public.users 
    WHERE id = auth.uid();

    IF NOT is_admin THEN
        RAISE EXCEPTION 'Only administrators can perform this action.';
    END IF;

    -- Update the role
    UPDATE public.users 
    SET role = new_role
    WHERE id = target_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_set_subscription_date(target_user_id UUID, new_ends_at TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    -- Verify the caller is an admin
    SELECT (role = 'admin') INTO is_admin 
    FROM public.users 
    WHERE id = auth.uid();

    IF NOT is_admin THEN
        RAISE EXCEPTION 'Only administrators can perform this action.';
    END IF;

    -- Update the date
    UPDATE public.users 
    SET subscription_ends_at = new_ends_at
    WHERE id = target_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
