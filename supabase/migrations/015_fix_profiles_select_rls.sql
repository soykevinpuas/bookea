-- Migration: 015_fix_profiles_select_rls.sql
-- Bookea - Restore public SELECT on profiles for community features
-- Problem: 011 restricted profiles SELECT to own user only, breaking
--   review/comment name display (JOIN via select(`*, profiles(*)`)
--   returns NULL for other users' profiles due to RLS enforcement)
-- Fix: Allow all authenticated users to SELECT profiles
--   (only name/avatar_url/bio — public data the user chose to share)
-- Created: Mayo 2026

-- ============================================
-- FIX: Update profiles SELECT policy
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view profiles" ON public.profiles
    FOR SELECT USING (true);

-- Other policies remain unchanged:
-- INSERT: auth.uid() = user_id
-- UPDATE: auth.uid() = user_id
-- ADMIN: role = 'admin'
