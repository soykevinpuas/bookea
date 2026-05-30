-- Migration: 024_add_bookmarks_composite_index.sql
-- Bookea - Add composite index for bookmark queries
-- Created: Mayo 2026

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_book_user
ON public.bookmarks(book_id, user_id);
