-- Migration: 002_add_stripe_customer_id.sql
-- Add stripe_customer_id to users table
-- Created: Marzo 2026

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX idx_users_stripe_customer ON public.users(stripe_customer_id);
