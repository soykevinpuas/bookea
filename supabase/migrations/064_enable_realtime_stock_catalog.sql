-- Migration: 064_enable_realtime_stock_catalog
-- Permite que cambios de stock fisico refresquen catalogo y paneles sin esperar polling.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'books'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.books;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'admin_stock'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_stock;
  END IF;
END $$;

ALTER TABLE public.books REPLICA IDENTITY FULL;
ALTER TABLE public.admin_stock REPLICA IDENTITY FULL;
