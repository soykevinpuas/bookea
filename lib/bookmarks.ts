import { createClientClient } from "@/lib/supabase";
import { Bookmark } from "@/types/bookmark";

const BOOKMARKS_KEY = "bookea-offline-bookmarks";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function getLocalBookmarks(bookId: string): Bookmark[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    return all[bookId] || [];
  } catch {
    return [];
  }
}

export function saveLocalBookmark(bookId: string, bookmark: Bookmark) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    if (!all[bookId]) all[bookId] = [];
    const existing = all[bookId].findIndex((b: Bookmark) => b.id === bookmark.id);
    if (existing >= 0) {
      all[bookId][existing] = { ...bookmark, synced: false };
    } else {
      all[bookId].push({ ...bookmark, synced: false });
    }
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn("Error saving local bookmark:", err);
  }
}

export function removeLocalBookmark(bookId: string, bookmarkId: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return;
    const all = JSON.parse(raw);
    if (all[bookId]) {
      all[bookId] = all[bookId].filter((b: Bookmark) => b.id !== bookmarkId);
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(all));
    }
  } catch {}
}

export async function getBookmarks(
  bookId: string,
  userId: string
): Promise<Bookmark[]> {
  const local = getLocalBookmarks(bookId);
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
      const localUnsynced = (all[bookId] || []).filter((b: { synced?: boolean }) => b.synced === false);
      const remoteIds = new Set(data.map(b => b.id));
      const filteredLocal = localUnsynced.filter((b: Bookmark) => !remoteIds.has(b.id));
      const merged = [...data.map(b => ({ ...b, synced: true })), ...filteredLocal];
      all[bookId] = merged;
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(all));
      return merged;
    }

    return data || local;
  } catch {
    return local;
  }
}

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
      all[bookId] = (all[bookId] || []).filter((b: Bookmark) => b.id !== newBookmark.id);
      all[bookId].push({ ...data, synced: true });
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(all));
    }

    return data || newBookmark;
  } catch {
    return newBookmark;
  }
}

export async function deleteBookmark(bookmarkId: string, bookId: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (raw) {
      const all = JSON.parse(raw);
      if (all[bookId]) {
        all[bookId] = all[bookId].filter((b: Bookmark) => b.id !== bookmarkId);
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(all));
      }
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
