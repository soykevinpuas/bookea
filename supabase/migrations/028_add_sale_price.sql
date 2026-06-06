-- Migration: 028_add_sale_price.sql
-- Bookea - Add sale_price to seller_sales for per-unit pricing
-- Created: Junio 2026

ALTER TABLE public.seller_sales
  ADD COLUMN sale_price NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Update existing sales with default price (200 = cost price)
UPDATE public.seller_sales SET sale_price = 200 WHERE sale_price = 0;
