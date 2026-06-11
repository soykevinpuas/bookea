-- Migration 031: Add admin UPDATE policy for stock_request_items
-- Fixes BUG #1 - Admin "Mark as Entregado" was failing due to missing RLS policy

CREATE POLICY "Admins update request items" ON public.stock_request_items
  FOR UPDATE USING (public.is_admin());
