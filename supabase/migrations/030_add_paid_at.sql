-- Migration 030: Add paid_at to seller_sales
-- Tracks which sales have been paid by the seller to the admin

ALTER TABLE public.seller_sales
  ADD COLUMN paid_at TIMESTAMPTZ;

-- RLS: Allow admins to update paid_at
CREATE POLICY "Admins update sales paid status" ON public.seller_sales
  FOR UPDATE USING (public.is_admin());
