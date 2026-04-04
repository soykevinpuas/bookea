-- Migration: 004_enable_realtime_reviews.sql
-- Bookea - Enable Realtime for the reviews table
-- Created: Abril 2026

-- 6.5.1 - Enable Realtime for the 'reviews' table
-- This allows clients to subscribe to changes in the reviews table for book interaction.
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
