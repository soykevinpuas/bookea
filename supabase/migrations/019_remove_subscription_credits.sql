-- Migration: 019_remove_subscription_credits.sql
-- Description: Remove subscription_credits table (migrated to unlimited-access model)
-- Created: Mayo 2026

DROP POLICY IF EXISTS "Users can view own subscription_credits" ON public.subscription_credits;
DROP POLICY IF EXISTS "Users can insert own subscription_credits" ON public.subscription_credits;
DROP POLICY IF EXISTS "Users can update own subscription_credits" ON public.subscription_credits;
DROP POLICY IF EXISTS "Admins can manage all subscription_credits" ON public.subscription_credits;

DROP TABLE IF EXISTS public.subscription_credits;
