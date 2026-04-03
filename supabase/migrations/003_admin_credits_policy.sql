-- Migration: 003_admin_credits_policy.sql
-- Description: Allow administrators to manage user credits
-- Created: Abril 2026

-- Add RLS policy for administrators on subscription_credits table
-- This allows admins to view, insert, update and delete credits for any user
CREATE POLICY "Admins can manage all subscription_credits" ON public.subscription_credits 
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);
