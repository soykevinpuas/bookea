// Progreso persistido por usuario/libro; el scroll se guarda como marcador relativo.
export interface ReadingProgress {
  // Identidad y pertenencia del progreso de lectura.
  id: string;
  user_id: string;
  book_id: string;
  // Posicion restaurable del lector EPUB.
  cfi_position: string | null;
  scroll_top: number | null;
  // Porcentaje mostrado en UI y timestamps para resolver sincronizacion.
  percent_complete: number;
  last_read_at: string;
  created_at: string;
  updated_at?: string;
  synced?: boolean;
}

// Subrayado o nota dentro de un EPUB.
export interface Highlight {
  // Relaciona el subrayado con usuario/libro y rango EPUB.
  id: string;
  user_id: string;
  book_id: string;
  cfi_start: string;
  cfi_end: string;
  // Contenido visible y personalizacion del subrayado.
  text: string;
  color: string;
  note: string | null;
  created_at: string;
  synced?: boolean;
}
