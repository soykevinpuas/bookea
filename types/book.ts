// Contrato compartido de libro usado por catalogo, biblioteca, admin y carrito.
export interface Book {
  // Identidad editorial principal del libro.
  id: string;
  title: string;
  author: string;
  author_id?: string;
  // Metadatos visibles para busqueda, detalle y portada.
  description: string | null;
  category: string | null;
  cover_url: string | null;
  epub_url: string | null;
  // Precios e inventario usados por catalogo, carrito y checkout.
  price_digital: number;
  price_physical: number;
  price_bundle: number | null;
  stock_physical: number;
  // Flags de disponibilidad y acceso premium.
  is_active: boolean;
  is_premium: boolean;
  created_at: string;
  // Campos derivados cuando el libro viene desde la biblioteca del usuario.
  percent_complete?: number;
  last_read_at?: string | null;
  access_type?: string | null;
  expires_at?: string | null;
}
