-- 017 - Tabla de carrito de compras por usuario
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('digital', 'physical')),
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, book_id, type)
);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own cart" ON cart_items
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users can insert own cart" ON cart_items
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update own cart" ON cart_items
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can delete own cart" ON cart_items
  FOR DELETE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION decrement_stock(p_book_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE books SET stock_physical = stock_physical - 1 
  WHERE id = p_book_id AND stock_physical > 0;
END;
$$;
