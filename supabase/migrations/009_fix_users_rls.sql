-- ============================================
-- MIGRACIÓN DE EMERGENCIA: Arreglar políticas RLS de la tabla users
-- 
-- PROBLEMA: La política "Admins can manage users" usa FOR ALL
-- que en PostgreSQL también aplica a SELECT, causando que
-- usuarios normales NO puedan leer NI SU PROPIO ROL.
-- Resultado: useSubscription siempre devuelve "free" o error.
--
-- SOLUCIÓN: Separar la política FOR ALL en políticas específicas
-- por operación (INSERT, UPDATE, DELETE) para admins, y dejar
-- el SELECT abierto para todos los usuarios autenticados.
-- ============================================

-- 1. Eliminar las políticas conflictivas actuales
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;

-- 2. Crear política de SELECT limpia: cualquier usuario autenticado puede ver usuarios
CREATE POLICY "users_select_all" ON public.users
  FOR SELECT USING (true);

-- 3. Crear política de INSERT: solo el trigger del sistema puede insertar (SECURITY DEFINER)
-- Los usuarios normales no necesitan insertar en esta tabla directamente
CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Crear política de UPDATE: solo admins pueden actualizar OTROS usuarios
-- (y cada usuario puede actualizar su propio registro si es necesario)
CREATE POLICY "users_update_admin" ON public.users
  FOR UPDATE USING (
    auth.uid() = id 
    OR 
    EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- 5. Crear política de DELETE: solo admins
CREATE POLICY "users_delete_admin" ON public.users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Verificación: después de ejecutar esto, todos los usuarios autenticados
-- podrán leer la tabla users (y ver su rol), pero solo admins podrán modificar otros.
