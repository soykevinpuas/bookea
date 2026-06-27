-- Migration: 059_harden_user_books_access
-- Cierra el bypass detectado en la auditoria 26/06:
-- los usuarios ya no pueden insertar/actualizar/borrar accesos digitales
-- directamente desde el cliente. Las concesiones de acceso deben pasar por
-- server actions, webhooks o RPCs SECURITY DEFINER validados.

ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own library" ON public.user_books;
DROP POLICY IF EXISTS "Users can insert own user_books" ON public.user_books;
DROP POLICY IF EXISTS "Users can update own user_books" ON public.user_books;
DROP POLICY IF EXISTS "Users can delete own user_books" ON public.user_books;
DROP POLICY IF EXISTS "Users can view own user_books" ON public.user_books;
DROP POLICY IF EXISTS "Admins can view all user_books" ON public.user_books;

CREATE POLICY "Users can view own user_books"
ON public.user_books
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user_books"
ON public.user_books
FOR SELECT
TO authenticated
USING (public.is_admin());
