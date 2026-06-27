import { createClientClient } from "@/lib/supabase";
import { ReadingProgress } from "@/types/reading";

const PROGRESS_KEY = "bookea-offline-progress";

function getScopedBookKey(bookId: string, userId?: string | null): string {
  return userId ? `${userId}:${bookId}` : bookId;
}

/**
 * 4.1.5 - Obtener progreso de lectura local (localStorage)
 */
export function getLocalProgress(bookId: string, userId?: string | null): ReadingProgress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    const scoped = all[getScopedBookKey(bookId, userId)];
    if (scoped) return scoped;
    const legacy = all[bookId];
    if (legacy && (!userId || legacy.user_id === userId)) return legacy;
    return null;
  } catch {
    return null;
  }
}

/**
 * 4.1.6 - Guardar progreso de lectura local (localStorage)
 */
export function saveLocalProgress(bookId: string, progress: Partial<ReadingProgress>) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const key = getScopedBookKey(bookId, progress.user_id);
    all[key] = {
      ...all[key],
      ...progress,
      updated_at: new Date().toISOString(),
      synced: false // Marca para el motor de sincronización
    };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn("Error saving local progress:", err);
  }
}

// 4.1 - Acceso a Datos (DAO) para guardar y persistir la posición de lectura (CFI) en Supabase
export async function getReadingProgress(
  bookId: string,
  userId: string
): Promise<ReadingProgress | null> {
  // 1. Siempre checar lo local primero (es lo más rápido y posiblemente más fresco)
  const local = getLocalProgress(bookId, userId);

  // 2. Si estamos offline, lo local es nuestra única verdad
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return local;
  }

  try {
    const supabase = createClientClient();
    const { data, error } = await supabase
      .from("reading_progress")
      .select("*")
      .eq("book_id", bookId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return local;

    // 3. Si lo local es más reciente que lo de la DB (o si no hay nada en DB), mandamos lo local
    if (data && local && (local as any).updated_at) {
      const serverTime = new Date(data.last_read_at || 0).getTime();
      const localTime = new Date((local as any).updated_at).getTime();
      if (localTime > serverTime) return local;
    }

    // 4. Si la DB es más reciente o lo único que hay, actualizamos lo local para estar al día
    if (data) {
      saveLocalProgress(bookId, {
        ...data,
        synced: true // Ya está en la nube
      } as any);
    }

    return data || local;
  } catch {
    return local;
  }
}

// 4.1.1 - Expresión Regular para proteger inserciones con formato UUID v4 estricto
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_REGEX.test(id);

export async function saveReadingProgress(
  bookId: string,
  userId: string,
  cfiPosition: string,
  percentComplete: number,
  scrollTop?: number
): Promise<void> {
  if (!isValidUUID(bookId)) return;

  const cleanPercent = Math.min(100, Math.max(0, Math.round(percentComplete * 100) / 100));

  // 1. GUARDAR LOCAL SIEMPRE (Offline First)
  saveLocalProgress(bookId, {
    book_id: bookId,
    user_id: userId,
    cfi_position: cfiPosition,
    scroll_top: scrollTop ?? null,
    percent_complete: cleanPercent,
    last_read_at: new Date().toISOString()
  } as any);

  // 2. Intentar guardar en nube si hay internet
  if (typeof window !== 'undefined' && !navigator.onLine) return;

  try {
    const supabase = createClientClient();
    const { error } = await supabase.from("reading_progress").upsert(
      {
        user_id: userId,
        book_id: bookId,
        cfi_position: cfiPosition,
        scroll_top: scrollTop ?? null,
        percent_complete: cleanPercent,
        last_read_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,book_id",
        ignoreDuplicates: false,
      }
    );

    if (!error) {
      // Marcar como sincronizado localmente
      const local = getLocalProgress(bookId, userId);
      if (local) {
        saveLocalProgress(bookId, { ...local, synced: true } as any);
      }
    }
  } catch {
    // Fallo silencioso en red: ya guardamos localmente arriba
  }
}
