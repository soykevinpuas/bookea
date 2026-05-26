-- Migration: 022_disable_client_orders_insert.sql
-- Bookea - Disable client-side direct orders insertion for orders_physical.
-- All orders must be processed server-side via Stripe webhooks or checkout fallbacks.
-- Created: Mayo 2026

DROP POLICY IF EXISTS "Users can insert own orders_physical" ON public.orders_physical;
