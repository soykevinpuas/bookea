-- Migración: 027_fix_is_active_subscriber_vendedor.sql
-- Descripción: Incluye el rol 'vendedor' en la función is_active_subscriber

CREATE OR REPLACE FUNCTION public.is_active_subscriber(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = user_uuid 
        AND (
            role = 'admin' 
            OR role = 'vendedor'
            OR (role = 'subscriber' AND (subscription_ends_at IS NULL OR subscription_ends_at > NOW()))
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_active_subscriber IS 'Verifica si un usuario es VIP (Admin, Vendedor o Suscriptor Activo).';
