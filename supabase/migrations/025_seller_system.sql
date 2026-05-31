-- Migration: 025_seller_system.sql
-- Bookea - Seller system: inventory, stock requests, sales tracking
-- Created: Mayo 2026

-- ============================================
-- 1. Add 'vendedor' to users role CHECK
-- ============================================
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('free', 'subscriber', 'admin', 'vendedor'));

-- ============================================
-- 2. SELLER_INVENTORY
--    Books currently assigned to a seller
-- ============================================
CREATE TABLE public.seller_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(seller_id, book_id)
);

-- ============================================
-- 3. SELLER_SALES
--    Books marked as sold by the seller (historical)
-- ============================================
CREATE TABLE public.seller_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 4. STOCK_REQUESTS
--    Seller requests for restock (like orders_physical)
-- ============================================
CREATE TABLE public.stock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'shipped', 'delivered', 'cancelled')),
  tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 5. STOCK_REQUEST_ITEMS
--    Line items for each stock request
-- ============================================
CREATE TABLE public.stock_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.stock_requests(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL
);

-- ============================================
-- 6. SECURITY DEFINER helper functions
-- ============================================
CREATE OR REPLACE FUNCTION public.is_vendedor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'vendedor');
$$;

-- Make sure get_my_role exists for client-side checks
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Update admin_change_user_role to allow 'vendedor'
CREATE OR REPLACE FUNCTION public.admin_change_user_role(target_user_id UUID, new_role TEXT)
RETURNS JSON AS $$
DECLARE
    caller_role TEXT;
    affected INT;
BEGIN
    SELECT role INTO caller_role
    FROM public.users 
    WHERE id = auth.uid();

    IF caller_role IS NULL OR caller_role != 'admin' THEN
        RETURN json_build_object('success', false, 'error', 'No tienes permisos de administrador');
    END IF;

    IF new_role NOT IN ('free', 'subscriber', 'admin', 'vendedor') THEN
        RETURN json_build_object('success', false, 'error', 'Rol inválido: ' || new_role);
    END IF;

    UPDATE public.users 
    SET role = new_role
    WHERE id = target_user_id;

    GET DIAGNOSTICS affected = ROW_COUNT;

    IF affected = 0 THEN
        RETURN json_build_object('success', false, 'error', 'Usuario no encontrado: ' || target_user_id);
    END IF;

    RETURN json_build_object('success', true, 'affected_rows', affected, 'new_role', new_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. ENABLE RLS
-- ============================================
ALTER TABLE public.seller_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_request_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. RLS POLICIES — seller_inventory
-- ============================================

-- Sellers see their own inventory
CREATE POLICY "Sellers view own inventory" ON public.seller_inventory
  FOR SELECT USING (auth.uid() = seller_id);

-- Admins see all inventory
CREATE POLICY "Admins view all inventory" ON public.seller_inventory
  FOR SELECT USING (public.is_admin());

-- Sellers update own inventory (mark as sold)
CREATE POLICY "Sellers update own inventory" ON public.seller_inventory
  FOR UPDATE USING (auth.uid() = seller_id);

-- Admins can manage all inventory (assign stock, adjust)
CREATE POLICY "Admins manage inventory" ON public.seller_inventory
  FOR ALL USING (public.is_admin());

-- Sellers can insert (needed for initial assignment flow via server)
-- but this is primarily admin — allow seller INSERT for direct assignment
CREATE POLICY "Sellers insert own inventory" ON public.seller_inventory
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

-- ============================================
-- 9. RLS POLICIES — seller_sales
-- ============================================

-- Sellers see their own sales
CREATE POLICY "Sellers view own sales" ON public.seller_sales
  FOR SELECT USING (auth.uid() = seller_id);

-- Sellers insert their own sales (mark as sold)
CREATE POLICY "Sellers insert own sales" ON public.seller_sales
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

-- Admins see all sales
CREATE POLICY "Admins view all sales" ON public.seller_sales
  FOR SELECT USING (public.is_admin());

-- ============================================
-- 10. RLS POLICIES — stock_requests
-- ============================================

-- Sellers see their own requests
CREATE POLICY "Sellers view own requests" ON public.stock_requests
  FOR SELECT USING (auth.uid() = seller_id);

-- Sellers create their own requests
CREATE POLICY "Sellers insert own requests" ON public.stock_requests
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

-- Admins see all requests and update status
CREATE POLICY "Admins view all requests" ON public.stock_requests
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins update requests" ON public.stock_requests
  FOR UPDATE USING (public.is_admin());

-- ============================================
-- 11. RLS POLICIES — stock_request_items
-- ============================================

-- Sellers see items from their own requests
CREATE POLICY "Sellers view own request items" ON public.stock_request_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stock_requests sr
      WHERE sr.id = stock_request_items.request_id
      AND sr.seller_id = auth.uid()
    )
  );

-- Sellers insert items into their own requests
CREATE POLICY "Sellers insert own request items" ON public.stock_request_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stock_requests sr
      WHERE sr.id = stock_request_items.request_id
      AND sr.seller_id = auth.uid()
    )
  );

-- Admins see all request items
CREATE POLICY "Admins view all request items" ON public.stock_request_items
  FOR SELECT USING (public.is_admin());

-- ============================================
-- 12. Update stock management functions
-- ============================================

DROP FUNCTION IF EXISTS public.decrement_stock(UUID);
DROP FUNCTION IF EXISTS public.decrement_stock(UUID, INT);

CREATE OR REPLACE FUNCTION public.decrement_stock(p_book_id UUID, p_quantity INT DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stock INT;
BEGIN
  SELECT stock_physical INTO current_stock FROM books WHERE id = p_book_id;

  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Libro no encontrado';
  END IF;

  IF current_stock < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %, solicitado: %', current_stock, p_quantity;
  END IF;

  UPDATE books SET stock_physical = stock_physical - p_quantity
  WHERE id = p_book_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_stock(p_book_id UUID, p_quantity INT DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE books SET stock_physical = stock_physical + p_quantity
  WHERE id = p_book_id;
END;
$$;

-- ============================================
-- 13. INDEXES
-- ============================================
CREATE INDEX idx_seller_inventory_seller ON public.seller_inventory(seller_id);
CREATE INDEX idx_seller_inventory_book ON public.seller_inventory(book_id);
CREATE INDEX idx_seller_sales_seller ON public.seller_sales(seller_id);
CREATE INDEX idx_seller_sales_book ON public.seller_sales(book_id);
CREATE INDEX idx_seller_sales_sold_at ON public.seller_sales(sold_at DESC);
CREATE INDEX idx_stock_requests_seller ON public.stock_requests(seller_id);
CREATE INDEX idx_stock_requests_status ON public.stock_requests(status);
CREATE INDEX idx_stock_request_items_request ON public.stock_request_items(request_id);
CREATE INDEX idx_stock_request_items_book ON public.stock_request_items(book_id);
