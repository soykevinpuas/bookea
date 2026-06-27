import { createClientClient } from "@/lib/supabase";
import { Highlight } from "@/types/reading";

const HIGHLIGHTS_KEY = "bookea-offline-highlights";

function getScopedBookKey(bookId: string, userId?: string | null): string {
  return userId ? `${userId}:${bookId}` : bookId;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  // Fallback to valid UUID v4 format
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c: any) =>
    (c ^ (crypto?.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );
}

/**
 * 4.3.1 - Obtener subrayados locales
 */
export function getLocalHighlights(bookId: string, userId?: string | null): Highlight[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HIGHLIGHTS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    const scoped = all[getScopedBookKey(bookId, userId)];
    if (scoped) return scoped;
    const legacy = all[bookId] || [];
    return userId ? legacy.filter((h: Highlight) => h.user_id === userId) : legacy;
  } catch {
    return [];
  }
}

/**
 * 4.3.2 - Guardar subrayado localmente
 */
export function saveLocalHighlight(bookId: string, highlight: Highlight) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(HIGHLIGHTS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const key = getScopedBookKey(bookId, highlight.user_id);
    if (!all[key]) all[key] = [];
    
    // Evitar duplicados
    const current = all[key] as any[];
    const exists = current.findIndex(h => h.id === highlight.id);
    if (exists >= 0) {
      current[exists] = { ...current[exists], ...highlight, synced: false };
    } else {
      current.unshift({ ...highlight, synced: false } as any);
    }
    
    localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn("Error saving local highlight:", err);
  }
}

// 4.3 - Acceso a Datos (DAO) para interactuar con la sub-entidad de Subrayados y Notas (Highlights)

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

    // 4.3.0.1 - ESTRATEGIA DE MERGE: Preservar locales no sincronizados
    if (data && typeof window !== 'undefined') {
      const raw = localStorage.getItem(HIGHLIGHTS_KEY);
      const all = raw ? JSON.parse(raw) : {};
      const key = getScopedBookKey(bookId, userId);
      const localUnsynced = (all[key] || []).filter((h: any) => h.synced === false);
      
      // Combinar: Servidor (prioridad si hay colisión por ID) + Locales no sincronizados
      const remoteIds = new Set(data.map(h => h.id));
      const filteredLocal = localUnsynced.filter((h: Highlight) => !remoteIds.has(h.id));
      
      const merged = [
        ...data.map(h => ({ ...h, synced: true })),
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

export async function saveHighlight(
  bookId: string,
  userId: string,
  cfiStart: string,
  cfiEnd: string,
  text: string,
  color: string,
  note?: string
): Promise<Highlight | null> {
  // 1. Crear ID temporal para guardado offline inmediato
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
  } as any;

  // 2. Guardar Local
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
      return newHighlight; // Devolvemos el local al menos
    }
    
    // Reemplazar el temporal en cache con el oficial de DB
    if (data) {
      const raw = localStorage.getItem(HIGHLIGHTS_KEY);
      const all = raw ? JSON.parse(raw) : {};
      const key = getScopedBookKey(bookId, userId);
      all[key] = (all[key] || []).filter((h: any) => h.id !== tempId);
      all[key].unshift({ ...data, synced: true });
      localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(all));
    }

    return data;
  } catch {
    return newHighlight;
  }
}

export async function updateHighlightNote(
  highlightId: string,
  note: string
): Promise<boolean> {
  // Actualización local rápida
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(HIGHLIGHTS_KEY);
    if (raw) {
      const all = JSON.parse(raw);
      for (const bookId in all) {
        const idx = all[bookId].findIndex((h: any) => h.id === highlightId);
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

export async function updateHighlightColor(
  highlightId: string,
  color: string
): Promise<boolean> {
  // Actualización local rápida
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(HIGHLIGHTS_KEY);
    if (raw) {
      const all = JSON.parse(raw);
      for (const bookId in all) {
        const idx = all[bookId].findIndex((h: any) => h.id === highlightId);
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

export async function deleteHighlight(
  highlightId: string
): Promise<boolean> {
  // Borrado local rápido
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(HIGHLIGHTS_KEY);
    if (raw) {
      const all = JSON.parse(raw);
      for (const bookId in all) {
        all[bookId] = all[bookId].filter((h: any) => h.id !== highlightId);
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
