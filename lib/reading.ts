import { createClientClient } from "@/lib/supabase";
import { ReadingProgress } from "@/types/reading";

const PROGRESS_KEY = "bookea-offline-progress";

// Separa progreso por usuario para no mezclar lecturas en dispositivos compartidos.
function getScopedBookKey(bookId: string, userId?: string | null): string {
  return userId ? `${userId}:${bookId}` : bookId;
}

// Lee progreso local compatible con claves legacy sin usuario.
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

// Guarda progreso offline-first y lo marca pendiente de sincronizacion.
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
      synced: false
    };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn("Error saving local progress:", err);
  }
}

// Combina Supabase con cache local; gana el dato local si fue actualizado offline.
export async function getReadingProgress(
  bookId: string,
  userId: string
): Promise<ReadingProgress | null> {
  const local = getLocalProgress(bookId, userId);

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

    if (data && local && (local as any).updated_at) {
      const serverTime = new Date(data.last_read_at || 0).getTime();
      const localTime = new Date((local as any).updated_at).getTime();
      if (localTime > serverTime) return local;
    }

    if (data) {
      saveLocalProgress(bookId, {
        ...data,
        synced: true
      } as any);
    }

    return data || local;
  } catch {
    return local;
  }
}

// Evita escribir progreso con ids malformados antes de tocar Supabase.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_REGEX.test(id);

// Persiste progreso local de inmediato y luego intenta sincronizarlo en Supabase.
export async function saveReadingProgress(
  bookId: string,
  userId: string,
  cfiPosition: string,
  percentComplete: number,
  scrollTop?: number
): Promise<void> {
  if (!isValidUUID(bookId)) return;

  const cleanPercent = Math.min(100, Math.max(0, Math.round(percentComplete * 100) / 100));

  saveLocalProgress(bookId, {
    book_id: bookId,
    user_id: userId,
    cfi_position: cfiPosition,
    scroll_top: scrollTop ?? null,
    percent_complete: cleanPercent,
    last_read_at: new Date().toISOString()
  } as any);

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
      const local = getLocalProgress(bookId, userId);
      if (local) {
        saveLocalProgress(bookId, { ...local, synced: true } as any);
      }
    }
  } catch {
    // Fallo de red tolerado: el progreso ya quedo guardado localmente.
  }
}
