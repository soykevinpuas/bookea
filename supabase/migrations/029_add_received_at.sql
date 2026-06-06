-- ============================================
-- Migration 029: Add received_at to stock_request_items
-- Allows sellers to receive items individually per book
-- ============================================

ALTER TABLE public.stock_request_items
ADD COLUMN received_at TIMESTAMPTZ;
