-- ============================================
-- MIGRACIÓN: Crear perfiles faltantes y asegurar RLS de Realtime
-- ============================================

-- 1. Crear perfiles para usuarios que no lo tengan (usuarios antiguos)
INSERT INTO public.profiles (user_id, id)
SELECT u.id, u.id
FROM public.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
);

-- 2. Verificar que RLS está habilitado en profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Recrear políticas de profiles (limpiar y crear nuevas)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Política SELECT: usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Política INSERT: crear propio perfil (fallback para usuarios sin trigger)
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política UPDATE: usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Política para admins
CREATE POLICY "Admins can manage all profiles" ON public.profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- 4. Habilitar Realtime para la tabla profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;