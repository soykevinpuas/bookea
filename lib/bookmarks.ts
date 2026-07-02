import { createClientClient } from "@/lib/supabase";
import { Bookmark } from "@/types/bookmark";

const BOOKMARKS_KEY = "bookea-offline-bookmarks";

// Scope por usuario para evitar que marcadores de cuentas distintas se mezclen.
function getScopedBookKey(bookId: string, userId?: string | null): string {
  return userId ? `${userId}:${bookId}` : bookId;
}

// Genera ids validos tambien cuando el marcador nace offline.
function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  // Fallback con formato UUID v4 valido si crypto.randomUUID no existe.
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => {
    const numericValue = Number(c);
    const randomByte = typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
      ? crypto.getRandomValues(new Uint8Array(1))[0]
      : Math.floor(Math.random() * 256);
    return (numericValue ^ (randomByte & (15 >> (numericValue / 4)))).toString(16);
  });
}

// Lee marcadores locales y soporta claves legacy previas al scope por usuario.
export function getLocalBookmarks(bookId: string, userId?: string | null): Bookmark[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    const scoped = all[getScopedBookKey(bookId, userId)];
    if (scoped) return scoped;
    const legacy = all[bookId] || [];
    return userId ? legacy.filter((b: Bookmark) => b.user_id === userId) : legacy;
  } catch {
    return [];
  }
}

// Guarda o reemplaza un marcador local y lo deja pendiente de sincronizacion.
export function saveLocalBookmark(bookId: string, bookmark: Bookmark) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const key = getScopedBookKey(bookId, bookmark.user_id);
    if (!all[key]) all[key] = [];
    const existing = all[key].findIndex((b: Bookmark) => b.id === bookmark.id);
    if (existing >= 0) {
      all[key][existing] = { ...bookmark, synced: false };
    } else {
      all[key].push({ ...bookmark, synced: false });
    }
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn("Error saving local bookmark:", err);
  }
}

// Borra un marcador del cache local usado por el lector offline.
export function removeLocalBookmark(bookId: string, bookmarkId: string, userId?: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return;
    const all = JSON.parse(raw);
    const key = getScopedBookKey(bookId, userId);
    if (all[key]) {
      all[key] = all[key].filter((b: Bookmark) => b.id !== bookmarkId);
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(all));
    }
  } catch {}
}

// Fusiona marcadores remotos con locales no sincronizados, evitando duplicados por id/CFI.
export async function getBookmarks(
  bookId: string,
  userId: string
): Promise<Bookmark[]> {
  const local = getLocalBookmarks(bookId, userId);
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return local;
  }

  try {
    const supabase = createClientClient();
    const { data, error } = await supabase
      .from("bookmarks")
      .select("*")
      .eq("book_id", bookId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) return local;

    if (data && typeof window !== 'undefined') {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      const all = raw ? JSON.parse(raw) : {};
      const key = getScopedBookKey(bookId, userId);
      const localUnsynced = (all[key] || []).filter((b: { synced?: boolean }) => b.synced === false);
      const remoteIds = new Set(data.map(b => b.id));
      const remoteCfi = new Set(data.map(b => b.cfi));
      const filteredLocal = localUnsynced.filter((b: Bookmark) => !remoteIds.has(b.id) && !remoteCfi.has(b.cfi));
      const merged = [...data.map(b => ({ ...b, synced: true })), ...filteredLocal];
      all[key] = merged;
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(all));
      return merged;
    }

    return data || local;
  } catch {
    return local;
  }
}

// Crea un marcador offline-first y reemplaza el temporal con el registro remoto.
export async function saveBookmark(
  bookId: string,
  userId: string,
  cfi: string,
  scrollTop: number,
  textPreview: string,
  progressAt: number
): Promise<Bookmark | null> {
  const newBookmark: Bookmark = {
    id: generateId(),
    user_id: userId,
    book_id: bookId,
    cfi,
    scroll_top: scrollTop,
    text_preview: textPreview,
    progress_at: progressAt,
    created_at: new Date().toISOString(),
  };

  saveLocalBookmark(bookId, newBookmark);

  if (typeof window !== 'undefined' && !navigator.onLine) {
    return newBookmark;
  }

  try {
    const supabase = createClientClient();
    const { data, error } = await supabase
      .from("bookmarks")
      .insert({
        user_id: userId,
        book_id: bookId,
        cfi,
        scroll_top: scrollTop,
        text_preview: textPreview,
        progress_at: progressAt,
      })
      .select()
      .single();

    if (error) {
      console.warn("Bookmark save error:", error.message);
      return newBookmark;
    }

    if (data) {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      const all = raw ? JSON.parse(raw) : {};
      const key = getScopedBookKey(bookId, userId);
      all[key] = (all[key] || []).filter((b: Bookmark) => b.id !== newBookmark.id);
      all[key].push({ ...data, synced: true });
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(all));
    }

    return data || newBookmark;
  } catch {
    return newBookmark;
  }
}

// Elimina un marcador localmente y luego intenta eliminarlo en Supabase.
export async function deleteBookmark(bookmarkId: string, bookId: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (raw) {
      const all = JSON.parse(raw);
      for (const key in all) {
        if (key === bookId || key.endsWith(`:${bookId}`)) {
          all[key] = all[key].filter((b: Bookmark) => b.id !== bookmarkId);
        }
      }
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(all));
    }
  }

  if (typeof window !== 'undefined' && !navigator.onLine) return true;

  try {
    const supabase = createClientClient();
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", bookmarkId);

    return !error;
  } catch {
    return false;
  }
}
