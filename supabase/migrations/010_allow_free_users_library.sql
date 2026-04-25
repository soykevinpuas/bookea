-- 1. Eliminar la política anterior para recrearla de forma limpia
DROP POLICY IF EXISTS "Users can manage their own library" ON public.user_books;

-- 2. Crear política que permite a CUALQUIER usuario autenticado gestionar su propia biblioteca
-- Esto incluye insertar nuevos libros aunque sean gratuitos.
CREATE POLICY "Users can manage their own library"
ON public.user_books
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Asegurar que las políticas de reading_progress también sean abiertas para todos
DROP POLICY IF EXISTS "Users can manage their own progress" ON public.reading_progress;
CREATE POLICY "Users can manage their own progress"
ON public.reading_progress
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
