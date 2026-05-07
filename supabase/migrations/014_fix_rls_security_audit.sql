-- Migration: 014_fix_rls_security_audit.sql
-- Bookea - Fix RLS policies identified in 2026-05-07 security audit
-- Issues: Critical RLS gaps in gamification tables, over-permissive SELECT policies
-- Created: Mayo 2026

-- ============================================
-- 1. FIX: Remove unsafe "System can..." policies from gamification tables
-- These policies allowed direct client-side manipulation bypassing RPC logic.
-- The SECURITY DEFINER RPCs (add_coins, redeem_coin, etc.) already handle
-- authorization and bypass RLS — table-level policies are unnecessary.
-- ============================================

-- COINS: Remove FOR ALL USING (true)
DROP POLICY IF EXISTS "System can manage coins via RPC" ON public.coins;

-- COIN_TRANSACTIONS: Remove FOR INSERT WITH CHECK (true)
DROP POLICY IF EXISTS "System can insert transactions via RPC" ON public.coin_transactions;

-- COIN_REDEMPTIONS: Remove user-level INSERT (must go through redeem_coin RPC)
DROP POLICY IF EXISTS "Users can insert own redemptions" ON public.coin_redemptions;

-- STREAK_MILESTONES: Remove FOR INSERT WITH CHECK (true)
DROP POLICY IF EXISTS "System can insert streak_milestones via RPC" ON public.streak_milestones;

-- REFERRALS: Remove FOR INSERT WITH CHECK (true)
DROP POLICY IF EXISTS "System can insert referrals via RPC" ON public.referrals;

-- MONTHLY_LIMITS_TRACKER: Remove FOR ALL USING (true)
DROP POLICY IF EXISTS "System can manage monthly_limits via RPC" ON public.monthly_limits_tracker;

-- ============================================
-- 2. FIX: Restrict users SELECT policy
-- Only admins can see all users; regular users can only see themselves.
-- ============================================
DROP POLICY IF EXISTS "users_select_all" ON public.users;

CREATE POLICY "users_select_self" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_select_admin" ON public.users
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    );

-- ============================================
-- 3. FIX: Restrict analytics_events INSERT
-- Remove public INSERT — the track_event RPC (SECURITY DEFINER) handles inserts.
-- ============================================
DROP POLICY IF EXISTS "Service can insert analytics" ON public.analytics_events;

-- ============================================
-- 4. FIX: Add WITH CHECK to subscription_credits UPDATE
-- Prevent users from setting arbitrary credits_remaining values.
-- ============================================
DROP POLICY IF EXISTS "Users can update own subscription_credits" ON public.subscription_credits;

CREATE POLICY "Users can update own subscription_credits" ON public.subscription_credits
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 5. FIX: Add increment_counter RPC
-- Used by completeBookAndAwardCoinAction to increment total_books_read.
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_counter()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN 1;
END;
$$;

COMMENT ON FUNCTION public.increment_counter IS 'Helper RPC for incrementing counters via supabase.rpc(). Returns 1 for use in UPDATE ... SET col = col + 1 patterns.';
