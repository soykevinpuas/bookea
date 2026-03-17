-- Migration: 001_initial_schema.sql
-- Bookea - Initial database schema
-- Created: Marzo 2026

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS (extends Supabase Auth)
-- ============================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'free' CHECK (role IN ('free', 'subscriber', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT,
    avatar_url TEXT,
    bio TEXT,
    reading_streak INTEGER DEFAULT 0,
    total_books_read INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- BOOKS
-- ============================================
CREATE TABLE public.books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    description TEXT,
    category TEXT,
    cover_url TEXT,
    epub_url TEXT,
    price_digital NUMERIC(10, 2) NOT NULL DEFAULT 0,
    price_physical NUMERIC(10, 2) NOT NULL DEFAULT 0,
    price_bundle NUMERIC(10, 2),
    stock_physical INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- USER_BOOKS (acceso a libros)
-- ============================================
CREATE TABLE public.user_books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    access_type TEXT NOT NULL CHECK (access_type IN ('subscription', 'permanent', 'gift')),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, book_id)
);

-- ============================================
-- SUBSCRIPTION_CREDITS
-- ============================================
CREATE TABLE public.subscription_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    cycle_start DATE NOT NULL,
    books_selected UUID[] DEFAULT '{}',
    credits_remaining INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- READING_PROGRESS
-- ============================================
CREATE TABLE public.reading_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    cfi_position TEXT,
    percent_complete NUMERIC(5, 2) DEFAULT 0,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, book_id)
);

-- ============================================
-- HIGHLIGHTS
-- ============================================
CREATE TABLE public.highlights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    cfi_start TEXT NOT NULL,
    cfi_end TEXT NOT NULL,
    text TEXT NOT NULL,
    color TEXT DEFAULT '#FFEB3B',
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- COMMENTS
-- ============================================
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- COMMENT_LIKES
-- ============================================
CREATE TABLE public.comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, comment_id)
);

-- ============================================
-- REVIEWS
-- ============================================
CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, book_id)
);

-- ============================================
-- ORDERS_PHYSICAL
-- ============================================
CREATE TABLE public.orders_physical (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'delivered', 'cancelled')),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    phone TEXT NOT NULL,
    shipping_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL,
    stripe_payment_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- WISHLIST
-- ============================================
CREATE TABLE public.wishlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, book_id)
);

-- ============================================
-- DISCOUNTS
-- ============================================
CREATE TABLE public.discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
    value NUMERIC(10, 2) NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- BADGES
-- ============================================
CREATE TABLE public.badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- USER_BADGES
-- ============================================
CREATE TABLE public.user_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_physical ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS POLICIES
-- ============================================
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Admins can manage users" ON public.users FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- ============================================
-- PROFILES POLICIES
-- ============================================
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- ============================================
-- BOOKS POLICIES
-- ============================================
CREATE POLICY "Anyone can view active books" ON public.books FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage books" ON public.books FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- ============================================
-- USER_BOOKS POLICIES
-- ============================================
CREATE POLICY "Users can view own user_books" ON public.user_books FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own user_books" ON public.user_books FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own user_books" ON public.user_books FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own user_books" ON public.user_books FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- SUBSCRIPTION_CREDITS POLICIES
-- ============================================
CREATE POLICY "Users can view own subscription_credits" ON public.subscription_credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription_credits" ON public.subscription_credits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription_credits" ON public.subscription_credits FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- READING_PROGRESS POLICIES
-- ============================================
CREATE POLICY "Users can view own reading_progress" ON public.reading_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reading_progress" ON public.reading_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reading_progress" ON public.reading_progress FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- HIGHLIGHTS POLICIES
-- ============================================
CREATE POLICY "Users can view own highlights" ON public.highlights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view book highlights" ON public.highlights FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_books ub WHERE ub.user_id = auth.uid() AND ub.book_id = highlights.book_id)
);
CREATE POLICY "Users can insert own highlights" ON public.highlights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own highlights" ON public.highlights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own highlights" ON public.highlights FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- COMMENTS POLICIES
-- ============================================
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any comments" ON public.comments FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- ============================================
-- COMMENT_LIKES POLICIES
-- ============================================
CREATE POLICY "Anyone can view comment_likes" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert own comment_likes" ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comment_likes" ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- REVIEWS POLICIES
-- ============================================
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert own reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON public.reviews FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- ORDERS_PHYSICAL POLICIES
-- ============================================
CREATE POLICY "Users can view own orders_physical" ON public.orders_physical FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders_physical" ON public.orders_physical FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all orders_physical" ON public.orders_physical FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);
CREATE POLICY "Admins can update orders_physical" ON public.orders_physical FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- ============================================
-- WISHLIST POLICIES
-- ============================================
CREATE POLICY "Users can view own wishlist" ON public.wishlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wishlist" ON public.wishlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own wishlist" ON public.wishlist FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- DISCOUNTS POLICIES
-- ============================================
CREATE POLICY "Anyone can view active discounts" ON public.discounts FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage discounts" ON public.discounts FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- ============================================
-- BADGES POLICIES
-- ============================================
CREATE POLICY "Anyone can view badges" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Admins can manage badges" ON public.badges FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- ============================================
-- USER_BADGES POLICIES
-- ============================================
CREATE POLICY "Anyone can view user_badges" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Users can view own user_badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own user_badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage user_badges" ON public.user_badges FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- ============================================
-- AUTO-CREATE PROFILE TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, role)
    VALUES (NEW.id, NEW.email, 'free');
    
    INSERT INTO public.profiles (user_id, id)
    VALUES (NEW.id, NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_user_books_user_id ON public.user_books(user_id);
CREATE INDEX idx_user_books_book_id ON public.user_books(book_id);
CREATE INDEX idx_reading_progress_user_id ON public.reading_progress(user_id);
CREATE INDEX idx_reading_progress_book_id ON public.reading_progress(book_id);
CREATE INDEX idx_highlights_user_id ON public.highlights(user_id);
CREATE INDEX idx_highlights_book_id ON public.highlights(book_id);
CREATE INDEX idx_comments_book_id ON public.comments(book_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);
CREATE INDEX idx_reviews_book_id ON public.reviews(book_id);
CREATE INDEX idx_orders_physical_user_id ON public.orders_physical(user_id);
CREATE INDEX idx_orders_physical_status ON public.orders_physical(status);
CREATE INDEX idx_wishlist_user_id ON public.wishlist(user_id);
CREATE INDEX idx_discounts_book_id ON public.discounts(book_id);
CREATE INDEX idx_discounts_active ON public.discounts(is_active);
