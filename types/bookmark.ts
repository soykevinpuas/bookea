// Marcador visual del lector con texto de contexto y estado de sync local.
export interface Bookmark {
  // Relaciona el marcador con usuario y libro.
  id: string;
  user_id: string;
  book_id: string;
  // Posicion EPUB: CFI localiza el texto y scroll_top afina la posicion visual.
  cfi: string;
  scroll_top: number;
  // Texto corto para mostrarlo en paneles/listas de marcadores.
  text_preview: string;
  progress_at: number;
  created_at: string;
  // Solo existe en cache local para saber si falta subirlo a Supabase.
  synced?: boolean;
}
