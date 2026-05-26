export interface ReadingProgress {
  id: string;
  user_id: string;
  book_id: string;
  cfi_position: string | null;
  scroll_top: number | null;
  percent_complete: number;
  last_read_at: string;
  created_at: string;
}

export interface Highlight {
  id: string;
  user_id: string;
  book_id: string;
  cfi_start: string;
  cfi_end: string;
  text: string;
  color: string;
  note: string | null;
  created_at: string;
}
