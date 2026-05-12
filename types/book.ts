export interface Book {
  id: string;
  title: string;
  author: string;
  author_id?: string;
  description: string | null;
  category: string | null;
  cover_url: string | null;
  epub_url: string | null;
  price_digital: number;
  price_physical: number;
  price_bundle: number | null;
  stock_physical: number;
  is_active: boolean;
  is_premium: boolean;
  created_at: string;
  percent_complete?: number;
  last_read_at?: string | null;
  access_type?: string | null;
}


