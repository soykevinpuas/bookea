export interface Book {
  id: string;
  title: string;
  author: string;
  description: string | null;
  category: string | null;
  cover_url: string | null;
  epub_url: string | null;
  price_digital: number;
  price_physical: number;
  price_bundle: number | null;
  stock_physical: number;
  is_active: boolean;
  created_at: string;
}
