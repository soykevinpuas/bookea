import { createClientClient } from "@/lib/supabase";
import { ReadingProgress } from "@/types/reading";

// 4.1 - Acceso a Datos (DAO) para guardar y persistir la posición de lectura (CFI) en Supabase
export async function getReadingProgress(
  bookId: string,
  userId: string
): Promise<ReadingProgress | null> {
  if (typeof window !== 'undefined' && !navigator.onLine) return null;
  try {
    const supabase = createClientClient();
    const { data, error } = await supabase
      .from("reading_progress")
      .select("*")
      .eq("book_id", bookId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// 4.1.1 - Expresión Regular para proteger inserciones con formato UUID v4 estricto
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_REGEX.test(id);

export async function saveReadingProgress(
  bookId: string,
  userId: string,
  cfiPosition: string,
  percentComplete: number
): Promise<void> {
  // 4.1.2 - Cancelar guardado si el identificador no cumple estrictamente la firma UUIDv4 (Seguridad de DB)
  if (!isValidUUID(bookId)) return;

  try {
    const supabase = createClientClient();

    // 4.1.3 - Redondeo estricto a 2 decimales para empalmar con la arquitectura Postgres NUMERIC(5,2)
    const cleanPercent = Math.min(100, Math.max(0, Math.round(percentComplete * 100) / 100));

    const { error } = await supabase.from("reading_progress").upsert(
      {
        user_id: userId,
        book_id: bookId,
        cfi_position: cfiPosition,
        percent_complete: cleanPercent,
        last_read_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,book_id",
        ignoreDuplicates: false,
      }
    );

    if (error) {
      if (error.code !== "23503") {
        console.warn("Reading progress save error:", error.message, "code:", error.code);
      }
    }
  } catch {
    // 4.1.4 - Fallo silencioso intencional: Evita abortar la lectura activa del cliente en caso de error de guardado en red
  }
}

