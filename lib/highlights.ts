import { createClientClient } from "@/lib/supabase";
import { Highlight } from "@/types/reading";

const HIGHLIGHTS_KEY = "bookea-offline-highlights";
type HighlightsCache = Record<string, Highlight[]>;

// Las claves por usuario evitan mezclar subrayados entre sesiones locales.
function getScopedBookKey(bookId: string, userId?: string | null): string {
  return userId ? `${userId}:${bookId}` : bookId;
}

// Genera UUID compatible para que un highlight creado offline pueda sincronizarse luego.
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

// Lee subrayados locales y conserva compatibilidad con cache legacy por libro.
export function getLocalHighlights(bookId: string, userId?: string | null): Highlight[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HIGHLIGHTS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as HighlightsCache;
    const scoped = all[getScopedBookKey(bookId, userId)];
    if (scoped) return scoped;
    const legacy = all[bookId] || [];
    return userId ? legacy.filter((h: Highlight) => h.user_id === userId) : legacy;
  } catch {
    return [];
  }
}

// Guarda o reemplaza un subrayado local y lo marca como pendiente de sync.
export function saveLocalHighlight(bookId: string, highlight: Highlight) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(HIGHLIGHTS_KEY);
    const all = (raw ? JSON.parse(raw) : {}) as HighlightsCache;
    const key = getScopedBookKey(bookId, highlight.user_id);
    if (!all[key]) all[key] = [];

    const current = all[key];
    const exists = current.findIndex(h => h.id === highlight.id);
    if (exists >= 0) {
      current[exists] = { ...current[exists], ...highlight, synced: false };
    } else {
      current.unshift({ ...highlight, synced: false });
    }

    localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn("Error saving local highlight:", err);
  }
}

// Mezcla subrayados remotos con locales no sincronizados.
export async function getHighlights(
  bookId: string,
  userId: string
): Promise<Highlight[]> {
  const local = getLocalHighlights(bookId, userId);
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return local;
  }

  try {
    const supabase = createClientClient();
    const { data, error } = await supabase
      .from("highlights")
      .select("*")
      .eq("book_id", bookId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return local;

    if (data && typeof window !== 'undefined') {
      const raw = localStorage.getItem(HIGHLIGHTS_KEY);
      const all = (raw ? JSON.parse(raw) : {}) as HighlightsCache;
      const key = getScopedBookKey(bookId, userId);
      const localUnsynced = (all[key] || []).filter((h) => h.synced === false);

      const remote = data as Highlight[];
      const remoteIds = new Set(remote.map(h => h.id));
      const filteredLocal = localUnsynced.filter((h: Highlight) => !remoteIds.has(h.id));

      const merged = [
        ...remote.map(h => ({ ...h, synced: true })),
        ...filteredLocal
      ];

      all[key] = merged;
      localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(all));
      return merged;
    }

    return data || local;
  } catch {
    return local;
  }
}

// Crea un subrayado offline-first y reemplaza el id temporal al confirmar DB.
export async function saveHighlight(
  bookId: string,
  userId: string,
  cfiStart: string,
  cfiEnd: string,
  text: string,
  color: string,
  note?: string
): Promise<Highlight | null> {
  const tempId = generateId();
  const newHighlight: Highlight = {
    id: tempId,
    book_id: bookId,
    user_id: userId,
    cfi_start: cfiStart,
    cfi_end: cfiEnd,
    text,
    color,
    note: note || null,
    created_at: new Date().toISOString()
  };

  saveLocalHighlight(bookId, newHighlight);

  if (typeof window !== 'undefined' && !navigator.onLine) {
    return newHighlight;
  }

  try {
    const supabase = createClientClient();
    const { data, error } = await supabase
      .from("highlights")
      .insert({
        user_id: userId,
        book_id: bookId,
        cfi_start: cfiStart,
        cfi_end: cfiEnd,
        text,
        color,
        note: note || null,
      })
      .select()
      .single();

    if (error) {
      console.warn("Highlight save error:", error.message);
      return newHighlight;
    }

    if (data) {
      const raw = localStorage.getItem(HIGHLIGHTS_KEY);
      const all = (raw ? JSON.parse(raw) : {}) as HighlightsCache;
      const key = getScopedBookKey(bookId, userId);
      all[key] = (all[key] || []).filter((h) => h.id !== tempId);
      all[key].unshift({ ...data, synced: true });
      localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(all));
    }

    return data;
  } catch {
    return newHighlight;
  }
}

// Actualiza nota localmente primero para que el lector responda sin red.
export async function updateHighlightNote(
  highlightId: string,
  note: string
): Promise<boolean> {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(HIGHLIGHTS_KEY);
    if (raw) {
      const all = JSON.parse(raw) as HighlightsCache;
      for (const bookId in all) {
        const idx = all[bookId].findIndex((h) => h.id === highlightId);
        if (idx >= 0) {
          all[bookId][idx].note = note;
          all[bookId][idx].synced = false;
        }
      }
      localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(all));
    }
  }

  if (typeof window !== 'undefined' && !navigator.onLine) return true;

  try {
    const supabase = createClientClient();
    const { error } = await supabase
      .from("highlights")
      .update({ note })
      .eq("id", highlightId);

    return !error;
  } catch {
    return false;
  }
}

// Actualiza color localmente primero y sincroniza si hay conexion.
export async function updateHighlightColor(
  highlightId: string,
  color: string
): Promise<boolean> {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(HIGHLIGHTS_KEY);
    if (raw) {
      const all = JSON.parse(raw) as HighlightsCache;
      for (const bookId in all) {
        const idx = all[bookId].findIndex((h) => h.id === highlightId);
        if (idx >= 0) {
          all[bookId][idx].color = color;
          all[bookId][idx].synced = false;
        }
      }
      localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(all));
    }
  }

  if (typeof window !== 'undefined' && !navigator.onLine) return true;

  try {
    const supabase = createClientClient();
    const { error } = await supabase
      .from("highlights")
      .update({ color })
      .eq("id", highlightId);

    return !error;
  } catch {
    return false;
  }
}

// Elimina el subrayado del cache local y luego intenta borrarlo en Supabase.
export async function deleteHighlight(
  highlightId: string
): Promise<boolean> {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(HIGHLIGHTS_KEY);
    if (raw) {
      const all = JSON.parse(raw) as HighlightsCache;
      for (const bookId in all) {
        all[bookId] = all[bookId].filter((h) => h.id !== highlightId);
      }
      localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(all));
    }
  }

  if (typeof window !== 'undefined' && !navigator.onLine) return true;

  try {
    const supabase = createClientClient();
    const { error } = await supabase
      .from("highlights")
      .delete()
      .eq("id", highlightId);

    return !error;
  } catch {
    return false;
  }
}
