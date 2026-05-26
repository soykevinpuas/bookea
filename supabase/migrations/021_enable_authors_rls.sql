-- Migration: 021_enable_authors_rls.sql
-- Bookea - Enable Row Level Security (RLS) on authors table and configure policies
-- Created: Mayo 2026

-- 1. Enable RLS on authors table
ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Anyone can view authors (authenticated or anonymous)
CREATE POLICY "Anyone can view authors" ON public.authors
    FOR SELECT USING (true);

-- 3. Policy: Only admins can manage authors (insert, update, delete)
CREATE POLICY "Admins can manage authors" ON public.authors
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
