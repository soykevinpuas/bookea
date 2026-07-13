import { createClientClient } from "@/lib/supabase";
import type { Bookmark } from "@/types/bookmark";
import type { Highlight, ReadingProgress } from "@/types/reading";

const PROGRESS_KEY = "bookea-offline-progress";
const HIGHLIGHTS_KEY = "bookea-offline-highlights";
const BOOKMARKS_KEY = "bookea-offline-bookmarks";

type OfflineProgressCache = Record<string, ReadingProgress>;
type OfflineHighlightsCache = Record<string, Highlight[]>;
type OfflineBookmarksCache = Record<string, Bookmark[]>;

/**
 * Sincronizador de Progreso Offline
 */
export async function syncOfflineProgress() {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  const supabase = createClientClient();

  // SINCRONIZAR PROGRESO
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const allProgress = JSON.parse(raw) as OfflineProgressCache;
      const bookIds = Object.keys(allProgress);
      for (const bookId of bookIds) {
        const item = allProgress[bookId];
        if (!item.synced && item.user_id) {
          const { error } = await supabase.from("reading_progress").upsert({
            user_id: item.user_id,
            book_id: item.book_id,
            cfi_position: item.cfi_position,
            percent_complete: item.percent_complete,
            last_read_at: item.last_read_at || new Date().toISOString(),
          }, { onConflict: "user_id,book_id" });
          if (!error) item.synced = true;
        }
      }
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(allProgress));
    }
  } catch (err) { console.error("Sync progress error:", err); }

  // SINCRONIZAR SUBRAYADOS
  try {
    const rawH = localStorage.getItem(HIGHLIGHTS_KEY);
    if (rawH) {
      const allHighlights = JSON.parse(rawH) as OfflineHighlightsCache;
      for (const bookId in allHighlights) {
        const highlights = allHighlights[bookId];
        for (const h of highlights) {
          if (!h.synced && h.user_id) {
            // Nota: Usamos upsert para manejar actualizaciones de color/nota offline
            const { error } = await supabase.from("highlights").upsert({
              user_id: h.user_id,
              book_id: h.book_id,
              cfi_start: h.cfi_start,
              cfi_end: h.cfi_end,
              text: h.text,
              color: h.color,
              note: h.note,
            }, { onConflict: "user_id,book_id,cfi_start" });
            if (!error) h.synced = true;
          }
        }
      }
      localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(allHighlights));
    }
  } catch (err) { console.error("Sync highlights error:", err); }

  // SINCRONIZAR MARCADORES
  try {
    const rawB = localStorage.getItem(BOOKMARKS_KEY);
    if (rawB) {
      const allBookmarks = JSON.parse(rawB) as OfflineBookmarksCache;
      for (const bookId in allBookmarks) {
        const bookmarks = allBookmarks[bookId];
        for (const b of bookmarks) {
          if (!b.synced && b.user_id) {
            const { error } = await supabase.from("bookmarks").upsert({
              id: b.id,
              user_id: b.user_id,
              book_id: b.book_id,
              cfi: b.cfi,
              scroll_top: b.scroll_top,
              text_preview: b.text_preview,
              progress_at: b.progress_at,
              created_at: b.created_at || new Date().toISOString(),
            }, { onConflict: "id" });
            if (!error) b.synced = true;
          }
        }
      }
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(allBookmarks));
    }
  } catch (err) { console.error("Sync bookmarks error:", err); }

  console.info("✓ Sincronización offline completada");
}
