-- Migration: 016_fix_admin_rls_recursion.sql
-- Bookea - Fix infinite RLS recursion on users table
-- Problem: 014 created users_select_admin with a subquery on public.users,
--   causing infinite recursion since the policy itself queries the same table.
-- Fix: Use a SECURITY DEFINER function to check admin role (bypasses RLS).
-- Created: Mayo 2026

-- ============================================
-- 1. Create SECURITY DEFINER admin check function
--    Runs as table owner, bypasses RLS, no recursion.
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;

-- ============================================
-- 2. Replace recursive admin SELECT policy
-- ============================================
DROP POLICY IF EXISTS "users_select_admin" ON public.users;

CREATE POLICY "users_select_admin" ON public.users
    FOR SELECT USING (public.is_admin());

-- ============================================
-- 3. Also fix coin_redemptions admin policy using same pattern
-- ============================================
DROP POLICY IF EXISTS "Admins can view all redemptions" ON public.coin_redemptions;

CREATE POLICY "Admins can view all redemptions" ON public.coin_redemptions
    FOR SELECT USING (public.is_admin());
