-- Migration: 023_add_scroll_top_and_bookmarks.sql
-- Bookea - Add scroll_top to reading_progress + bookmarks table
-- Created: Mayo 2026

-- ============================================
-- READING_PROGRESS: Add scroll_top column
-- ============================================
ALTER TABLE public.reading_progress
ADD COLUMN scroll_top INTEGER;

-- ============================================
-- BOOKMARKS: New table for virtual bookmarks/ribbons
-- ============================================
CREATE TABLE public.bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    cfi TEXT NOT NULL,
    scroll_top INTEGER NOT NULL DEFAULT 0,
    text_preview TEXT NOT NULL DEFAULT '',
    progress_at NUMERIC(5, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- BOOKMARKS POLICIES
-- ============================================
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks" ON public.bookmarks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_bookmarks_user_id ON public.bookmarks(user_id);
CREATE INDEX idx_bookmarks_book_id ON public.bookmarks(book_id);
