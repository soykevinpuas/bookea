-- Migración: 005_pivot_to_subscription.sql
-- Descripción: Pivote del modelo de Créditos al modelo de Suscripción (Premium)
-- Autor: Antigravity
-- Fecha: Abril 2026

-- 1.1 - Extender la tabla Users para la gestión de suscripciones
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- 1.2 - Categorizar Libros (Premium vs Gratis)
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT true;

-- 1.3 - Función auxiliar para verificar si un usuario es suscriptor activo
CREATE OR REPLACE FUNCTION public.is_active_subscriber(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = user_uuid 
        AND role = 'subscriber' 
        AND (subscription_ends_at IS NULL OR subscription_ends_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1.4 - Actualizar políticas RLS de Libros
-- Primero eliminamos la política antigua para redefinirla
DROP POLICY IF EXISTS "Anyone can view active books" ON public.books;

-- Política para ver metadatos (todos pueden ver qué libros hay)
CREATE POLICY "Anyone can view active books" ON public.books 
FOR SELECT USING (is_active = true);

-- 1.5 - Restricción de acceso al contenido (Lectura)
-- Nota: La protección del epub_url se manejará mediante lógica de aplicación 
-- y verificando la suscripción antes de permitir la descarga o apertura del lector.

-- 1.6 - Documentación de columnas para auditorías futuras
COMMENT ON COLUMN public.users.subscription_ends_at IS 'La fecha en que termina el acceso premium del usuario.';
COMMENT ON COLUMN public.books.is_premium IS 'Si es TRUE, requiere suscripción activa para leer. Si es FALSE, es gratuito.';
