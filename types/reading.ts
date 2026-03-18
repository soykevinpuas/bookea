export interface ReadingProgress {
  id: string;
  user_id: string;
  book_id: string;
  cfi_position: string | null;
  percent_complete: number;
  last_read_at: string;
  created_at: string;
}
